import {
	Container,
	Instance,
	appendInitialChild,
	createInstance,
	createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
	HostRoot,
	HostComponent,
	HostText,
	FunctionComponent,
	Fragment
} from './workTags';
import { NoFlags, Update } from './FiberFlags';

function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update;
}

// 递归中的归阶段
export const completeWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps;
	const current = wip.alternate;

	switch (wip.tag) {
		case HostComponent:
			// 对于HostComponent，wip.stateNode存储的就是dom
			if (current !== null && wip.stateNode) {
				// update
				// 1. props是否变化
				// 2. 如果props发生变化，需要打上Update标志
				// 这里应该是简化了实现了，react应该是要将每个属性比较，只要有一个需要更新都要打上标识，并利用updateQueue记录
				// 这里显然没有做这些工作，而是每次都将属性更新了
				// updateFiberProps(wip.stateNode, newProps);
				markUpdate(wip);
			} else {
				// 1. 构建dom
				// 2. 将dom插入到dom树中
				// 对于浏览器环境instance就是dom
				const instance = createInstance(wip.type, newProps);
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps.content;
				const newText = newProps.content;
				if (oldText !== newText) {
					markUpdate(wip);
				}
			} else {
				// 1. 构建dom
				// 2. 将dom插入到dom树中
				// 对于浏览器环境instance就是dom
				const instance = createTextInstance(newProps.content);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostRoot:
		case FunctionComponent:
		case Fragment:
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('未处理的completeWork情况', wip);
			}
			break;
	}
};

function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
	let node = wip.child;

	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node?.stateNode);
		} else if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}
		// ? 正常应该走不到这一步，因为node一开始就是wip.child，后面要往上遍历前也会先判断node.return!==wip，除非wip.child===wip这样，否则照理是进不到这个逻辑的，所以感觉有点奇怪
		if (node === wip) {
			return;
		}
		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return;
			}
			node = node.return;
		}
		// ? 为什么是在这里指定sibling.return的指向？目前beginWork还没考虑多子节点的情况，但是后续考虑了之后，不是在那里定义指向更好吗？当然在这里指向也可以，就是感觉有点疑惑
		/* 		
			老师的解答：所有 归的阶段都可以用来保持连接的稳定
			因为结构不稳定出问题很难排查
			也就是这里的代码是一种保险的设置，所以确实可能是重复设置的
		*/
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = wip.child;

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}
	wip.subtreeFlags |= subtreeFlags;
}
