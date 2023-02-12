// 递归中的递阶段

import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';

/**
 * 比较fiberNode和ReactElement，返回子fiberNode
 */
// 这个lane就是当前render执行所属的优先级lane，整个render过程都是这个lane
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	switch (wip.tag) {
		case HostRoot:
			// 会用到processUpdateQueue，所以需要lane
			return updateHostRoot(wip, renderLane);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			// 会用到processUpdateQueue，所以需要lane
			return updateFunctionComponent(wip, renderLane);
		case Fragment:
			return updateFragment(wip);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}
	return null;
};

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	const nextChildren = renderWithHooks(wip, renderLane);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<ReactElementType | null>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	// 这里的memoizedState是ReactElementType
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
	updateQueue.shared.pending = null;
	wip.memoizedState = memoizedState;
	const nextChildren = wip.memoizedState;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function reconcileChildren(
	wip: FiberNode,
	children?: ReactElementType | string | number
) {
	const current = wip.alternate;

	/**
	 * 这里其实就是要做一个性能优化，就是希望mount时，直接构建完整棵树再插入，而更新时是局部更新的，就不需要优化，因此mount和update会有不同的策略
	 * mount时只需要在HostRootFiber里一次插入就好了，mount时除了HostRootFiber是存在current，其他的wip是没有current的，而update时就都有current了，因此只要通过判断current调用不同的方法就可以实现这个性能优化
	 */
	// hostRootFiber走到这个流程是一定会有current的，其他的只有mount后才有current
	if (current !== null) {
		// update&或者是hostRootFiber
		wip.child = reconcileChildFibers(wip, current.child, children);
	} else {
		// mount（除了hostRootFiber）
		wip.child = mountChildFibers(wip, null, children);
	}
}

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}
