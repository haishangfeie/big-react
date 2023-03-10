import {
	Container,
	Instance,
	appendChildToContainer,
	commitUpdate,
	insertChildToContainer,
	removeChild
} from 'hostConfig';
import {
	ChildDeletion,
	Flags,
	MutationMask,
	NoFlags,
	PassiveEffect,
	PassiveMask,
	Placement,
	Update
} from './FiberFlags';
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { Effect, FCUpdateQueue } from './fiberHooks';
import { EffectTag, HookHasEffect } from './hookEffectTags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	nextEffect = finishedWork;

	// 向下遍历
	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;

		if (
			(nextEffect.subtreeFlags & (MutationMask | PassiveEffect)) !== NoFlags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			// 向上遍历
			up: while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect, root);
				const sibling: FiberNode | null = nextEffect.sibling;
				if (sibling !== null) {
					nextEffect = sibling;
					break up;
				}
				nextEffect = nextEffect.return;
			}
		}
	}
};

const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const flags = finishedWork.flags;

	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		// 移除Placement
		finishedWork.flags &= ~Placement;
	}
	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);
		// 移除Update
		finishedWork.flags &= ~Update;
	}
	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete, root);
			});
		}
		// 移除ChildDeletion
		finishedWork.flags &= ~ChildDeletion;
	}

	if ((flags & PassiveEffect) !== NoFlags) {
		// 收集effect回调
		// fiber从下（叶子）到上遍历的
		commitPassiveEffect(finishedWork, root, 'update');
		finishedWork.flags &= ~PassiveEffect;
	}
};

function commitPassiveEffect(
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof PendingPassiveEffects
) {
	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
	) {
		return;
	}

	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue !== null) {
		if (updateQueue.lastEffect === null) {
			throw new Error('当FC存在PassiveEffect flag时，不应该不存在effect');
		} else {
			root.pendingPassiveEffects[type].push(updateQueue.lastEffect);
		}
	}
}

function recordChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	/* 
		1. 取存下的最后一个hostRoot节点
		2. 每找到一个host节点，都判断一下是不是1.中节点的兄弟节点
	*/
	// 1. 找到第一个hootRoot节点（第一个要被删除节点的根dom）
	const lastOne = childrenToDelete[childrenToDelete.length - 1];
	if (!lastOne) {
		childrenToDelete.push(unmountFiber);
	} else {
		// 2. 每找到一个host节点，都判断一下是不是1.中节点的兄弟节点
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelete.push(node);
				// ? 这个是我自己加的，按我的理解这里应该要break的
				break;
			}
			node = node.sibling;
		}
	}
}

function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
	const rootChildrenToDelete: FiberNode[] = [];
	// 递归子树
	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				recordChildrenToDelete(rootChildrenToDelete, unmountFiber);
				// TODO: 解绑ref
				return;
			case HostText:
				recordChildrenToDelete(rootChildrenToDelete, unmountFiber);
				return;
			case FunctionComponent:
				// TODO 解绑ref
				// useEffect unmount
				// fiber从上到下（叶子）遍历的
				commitPassiveEffect(unmountFiber, root, 'unmount');
				return;
			// 如果是类组件ClassComponent,会调用ComponentWillUnmount生命周期钩子
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber);
				}
				break;
		}
	});
	// 移除rootHostComponent的Dom
	if (rootChildrenToDelete.length) {
		const parent = getHostParent(childToDelete);
		if (parent) {
			rootChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, parent);
			});
		} else if (__DEV__) {
			console.warn('没有找到父节点，无法移除');
		}
	}

	// ? 垃圾回收这块没有太理解
	// 解除引用，这是为了可以触发到垃圾回收
	childToDelete.return = null;
	childToDelete.child = null;
}

function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root;
	// 遍历
	while (true) {
		onCommitUnmount(node);
		while (node.child !== null) {
			node.child.return = node;
			node = node.child;
			onCommitUnmount(node);
		}
		if (node === root) {
			return;
		}
		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork);
	}
	const hostParent = getHostParent(finishedWork);

	const hostSibling = getHostSibling(finishedWork);

	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(
			finishedWork,
			hostParent,
			hostSibling
		);
	}
};

/* 
	要找节点的hostSibling，要注意：
	1. 节点的sibling可能不是hostSibling，这时需要往下遍历直到找到hostText或者hostComponent
	2. 节点的sibling，可能是父节点的兄弟节点，也就是当节点没有sibling时，需要往上遍历直到遇到hostText或者hostCompont或者发现兄弟节点
	例子：<App/><div></div>
	function App(){return (<A />)}
	对于A来说，它的host sibling是其父节点的sibling
	3. 不稳定的host节点不能作为目标兄弟节点
	例子：节点已经被标记为Placement，这个节点就是不稳定的，因为这个节点可能需要移动
*/
function getHostSibling(fiber: FiberNode): Instance | null {
	let node: FiberNode = fiber;

	findSibling: while (true) {
		while (node.sibling === null) {
			// 向上遍历
			const parent: FiberNode | null = node.return;
			if (
				parent === null ||
				parent.tag === HostRoot ||
				parent.tag === HostComponent
			) {
				return null;
			}
			node = parent;
		}
		// sibling存在，往下遍历直到发现HostComponent或者HostText
		if (node.sibling) {
			node.sibling.return = node.return;
			node = node.sibling;
		}

		while (node.tag !== HostComponent && node.tag !== HostText) {
			// 向下遍历
			if ((node.flags & Placement) !== NoFlags) {
				// 这表示这个节点是不稳定的
				continue findSibling;
			}
			if (node.child === null) {
				continue findSibling;
			} else {
				// ? 为什么这里要赋值return?这个不是binginWork在获取子fiber的时候就已经设置了吗？
				// 理由就是为了避免结构不稳定导致的bug，所以加了一层保险
				node.child.return = node;
				node = node.child;
			}
		}

		// 这表示这个节点是稳定的
		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode;
		}
		return null;
	}
}

function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return;
	while (parent) {
		const parentTag = parent.tag;
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}
		parent = parent.return;
	}

	if (__DEV__) {
		console.warn('未找到hostParent', fiber);
	}
	return null;
}

function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance | null
) {
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}

		return;
	}
	const child = finishedWork.child;

	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;

		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}

function commitHookEffectList(
	flags: Flags,
	lastEffect: Effect,
	callback: (effect: Effect) => void
) {
	let effect = lastEffect.next;
	const firstEffect = lastEffect.next;
	do {
		if (effect === null) {
			if (__DEV__) {
				console.warn('lastEffect', lastEffect);
			}
			throw new Error('effect不应该是null');
		}
		if ((effect.tag & flags) === flags) {
			callback(effect);
		}
		effect = effect.next;
	} while (effect !== firstEffect);
}

export function commitHookEffectListUnmount(
	flags: EffectTag,
	lastEffect: Effect
) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;
		if (typeof destroy === 'function') {
			destroy();
		}
		effect.tag &= ~HookHasEffect;
	});
}

export function commitHookEffectListDestroy(
	flags: EffectTag,
	lastEffect: Effect
) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;
		if (typeof destroy === 'function') {
			destroy();
		}
	});
}

export function commitHookEffectListCreate(
	flags: EffectTag,
	lastEffect: Effect
) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const create = effect.create;
		if (typeof create === 'function') {
			effect.destroy = create();
		}
	});
}
