import { scheduleMicroTask } from 'hostConfig';
import { MutationMask, NoFlags } from './FiberFlags';
import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null;

// 这个lane就是当前render执行所属的优先级lane，整个render过程都是这个lane
let wipRootRenderLane: Lane = NoLane;

// 这个lane就是当前render执行所属的优先级lane，整个render过程都是这个lane
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
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
	// 获取待处理的优先级集合中的最高优先级作为当下要处理更新的优先级lane
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	if (updateLane === NoLane) {
		return;
	}

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
		// 其他优先级，使用宏任务调度
		console.warn('todo:其他优先级，暂未实现');
	}
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
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		// 有两种可能：
		// 1. 是比SyncLane低优先级的调度
		// 2. 是NoLane
		// 如果当下没有同步优先级了，那么就应该执行其他优先级的更新，如果没有优先级就不需要再往下执行了，这些ensureRootIsScheduled里面就处理了，因此可以直接调用这个方法
		ensureRootIsScheduled(root);
		return;
	}
	if (__DEV__) {
		console.warn('render阶段开始');
	}
	// 初始化
	prepareFreshStack(root, SyncLane);

	do {
		try {
			workLoop();
			break;
		} catch (e) {
			console.error(e);
			workInProgress = null;
		}
	} while (true);

	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;
	wipRootRenderLane = NoLane;

	root.finishedLane = SyncLane;
	// 根据wip fiberNode树以及树中的flags执行具体的dom操作
	commitRoot(root);
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

	/**
	 * commit存在3个子阶段：beforeMutation,mutation,layout
	 */
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		// mutation
		commitMutationEffects(finishedWork);
		root.current = finishedWork;
	} else {
		root.current = finishedWork;
	}
}

function workLoop() {
	while (workInProgress !== null) {
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
