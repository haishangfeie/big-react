import { scheduleMicroTask } from 'hostConfig';
import { MutationMask, NoFlags, PassiveMask } from './FiberFlags';
import { beginWork } from './beginWork';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitMutationEffects
} from './commitWork';
import { completeWork } from './completeWork';
import {
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects,
	createWorkInProgress
} from './fiber';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	lanesToSchedulerPriority,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_shouldYield,
	unstable_cancelCallback
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';

type RootExitStatus = number;

/** 中断执行 */
const RootInComplete = 1;
/** 执行完 */
const RootCompleted = 2;
// TODO: 执行过程报错

let workInProgress: FiberNode | null = null;

/**
 * 这个lane就是当前render执行所属的优先级lane，整个render过程都是这个lane
 */
let wipRootRenderLane: Lane = NoLane;

/**
 * 标识是否已经触发useEffect的调度
 */
let rootDoesHasPassiveEffect = false;

// 这个lane就是当前render执行所属的优先级lane，整个render过程都是这个lane
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	root.finishedLane = NoLane;
	root.finishedWork = null;
	workInProgress = createWorkInProgress(root.current, {});
	wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// TODO:后续实现调度功能
	const root = markUpdateFromFiberToRoot(fiber);
	if (__DEV__) {
		if (root === null) {
			console.warn('root无法找到，存入的fiber:', fiber);
		}
	}
	if (root) {
		// 这个lane将添加到pendingLanes（表示未更新的优先级集合）
		markRootUpdated(root, lane);
		ensureRootIsScheduled(root);
	}
}

// schedule阶段入口
function ensureRootIsScheduled(root: FiberRootNode) {
	if (__DEV__) {
		console.warn('schedule阶段入口');
	}
	const curCallback = root.callbackNode;
	// 保证useEffect已经执行
	// 原因：因为useEffect中可以触发更新，而这个更新的优先级可能比当前的优先级更高，需要打断当前的更新
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
	if (didFlushPassiveEffect) {
		if (root.callbackNode !== curCallback) {
			return null;
		}
	}

	// 获取待处理的优先级集合中的最高优先级作为当下要处理更新的优先级lane
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	const existingCallback = root.callbackNode;

	if (updateLane === NoLane) {
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback);
		}
		root.callbackNode = null;
		root.callbackPriority = NoLane;
		return;
	}

	const curPriority = updateLane;
	const prevPriority = root.callbackPriority;

	// 优先级相同的时候，会走优化路径，因此这边的逻辑不需要再往下执行
	if (curPriority === prevPriority) {
		return;
	}

	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback);
	}

	let newCallbackNode = null;

	if (updateLane === SyncLane) {
		// 同步优先级，用微任务调度
		if (__DEV__) {
			console.warn(`在微任务中调度，优先级:${updateLane}`);
		}

		/* 
			细节：
			1. 同步代码中可以触发多次更新，更新方法都先存到数组中，
			每次更新都会把遍历数组执行更新的任务加入到微任务中，
			但不是没有放入微任务的任务都会最终遍历数组，因为有一个标志位，在初次遍历任务触发时，标志位就会禁止后续任务触发（即flushSyncCallbacks在一个微任务中可以执行多次，但是内部的遍历只会执行一次）
			2. 更新数组就是多个更新方法，例如performSyncWorkOnRoot，
			遍历执行，意味着performSyncWorkOnRoot可以被调用多次，因此这个方法里也同样需要确保其只执行一次，确保的方法是获取目前的最高优先级，看是不是同步任务，是的话就是第一次执行，否则就证明同步任务已经执行过了
		*/
		// 先将更新存到数组中
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
		// 在微任务中，遍历执行更新数组中的每一个方法
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		if (__DEV__) {
			console.warn(`在宏任务中调度，优先级:${updateLane}`);
		}
		// 其他优先级，使用宏任务调度
		const schedulePriority = lanesToSchedulerPriority(updateLane);
		newCallbackNode = scheduleCallback(
			schedulePriority,
			// @ts-ignore
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}

	root.callbackNode = newCallbackNode;
	root.callbackPriority = curPriority;
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

function markUpdateFromFiberToRoot(fiber: FiberNode): FiberRootNode | null {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}
	if (node.tag === HostRoot) {
		return node.stateNode as FiberRootNode;
	}
	return null;
}

function performSyncWorkOnRoot(root: FiberRootNode) {
	if (__DEV__) {
		console.warn('performSyncWorkOnRoot');
	}
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		// 有两种可能：
		// 1. 是比SyncLane低优先级的调度
		// 2. 是NoLane
		// 如果当下没有同步优先级了，那么就应该执行其他优先级的更新，如果没有优先级就不需要再往下执行了，这些ensureRootIsScheduled里面就处理了，因此可以直接调用这个方法
		ensureRootIsScheduled(root);
		return;
	}

	const exitStatus = renderRoot(root, SyncLane, false);
	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		wipRootRenderLane = NoLane;

		root.finishedLane = SyncLane;
		// 根据wip fiberNode树以及树中的flags执行具体的dom操作
		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现同步更新结束状态');
	}
}

function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	const lane = getHighestPriorityLane(root.pendingLanes);
	const currentCallbackNode = root.callbackNode;
	if (lane === NoLane) {
		return null;
	}
	const needSync = lane === SyncLane || didTimeout;

	const exitStatus = renderRoot(root, lane, !needSync);

	ensureRootIsScheduled(root);
	if (__DEV__) {
		console.warn(`exitStatus:${exitStatus}`);
	}
	if (exitStatus === RootInComplete) {
		// 中断
		if (root.callbackNode !== currentCallbackNode) {
			return null;
		}
		return performConcurrentWorkOnRoot.bind(null, root);
	}
	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		wipRootRenderLane = NoLane;

		root.finishedLane = lane;
		// 根据wip fiberNode树以及树中的flags执行具体的dom操作
		if (__DEV__) {
			console.log(`root:`, root);
		}
		commitRoot(root);
	}
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}

	const lane = root.finishedLane;

	if (lane === NoLane && __DEV__) {
		console.error('commit阶段root.finishedLane不应该是NoLane');
	}
	markRootFinished(root, lane);

	// 重置
	root.finishedWork = null;
	root.finishedLane = NoLane;

	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		if (!rootDoesHasPassiveEffect) {
			rootDoesHasPassiveEffect = true;
			// 调度副作用
			// 用NormalPriority这个优先级来调度，可以理解为调度一个异步函数
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	/**
	 * commit存在3个子阶段：beforeMutation,mutation,layout
	 */
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		// mutation
		commitMutationEffects(finishedWork, root);
		root.current = finishedWork;
	} else {
		root.current = finishedWork;
	}

	rootDoesHasPassiveEffect = false;
	ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	let didFlushPassiveEffect = false;
	// effect的执行顺序是从叶子往上执行所有的destroy，再从叶子往上执行所有的create
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListUnmount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];

	// 执行上一次的destroy
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});

	// 执行本次的create
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update = [];

	// 在effect中，也可以触发更新，例如：
	/*
		useEffect(()=>{
			setNum(1)
		})
	*/
	// ? 这里用flushSyncCallbacks还是有点没有理解，不理解的地方在于syncQueue是怎样存入数组的
	/* 
		setNum触发更新，是可以走到scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
		这里是同步的将函数放入数组。在之前执行flushSyncCallbacks时syncQueue已经重置为null，这里就会重新有一个未执行的数组，
		如果不调用flushSyncCallbacks，以下代码也会在下一个微任务里面调用：
		scheduleMicroTask(flushSyncCallbacks);
		而马上调用，可以在本个微任务中完成
	*/

	flushSyncCallbacks();

	return didFlushPassiveEffect;
}

function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function workLoopCurrent() {
	while (workInProgress !== null && !unstable_shouldYield()) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	// 通过current 子FiberNode和子ReactElement生成子FiberNode
	// next可能是子fiberNode也可能是null
	const next = beginWork(fiber, wipRootRenderLane);
	fiber.memoizedProps = fiber.pendingProps;

	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;

	do {
		completeWork(node);
		const sibling = node.sibling;
		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}
		node = node.return;
		workInProgress = node;
	} while (node !== null);
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.warn(`开始${shouldTimeSlice ? '并发' : '同步'}更新`);
	}

	// 非中断的时候才需要初始化,wipRootRenderLane===lane说明当前是处于中断
	if (wipRootRenderLane !== lane) {
		// 初始化
		prepareFreshStack(root, lane);
	}

	do {
		try {
			shouldTimeSlice ? workLoopCurrent() : workLoopSync();
			break;
		} catch (e) {
			console.error(e);
			workInProgress = null;
		}
	} while (true);

	// 中断执行 || render阶段执行完
	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete;
	}

	// render阶段执行完
	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error(`render阶段执行完不应该不为null`);
	}

	// TODO: 还没处理render阶段报错的情况
	return RootCompleted;
}
