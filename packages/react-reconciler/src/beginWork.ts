// 递归中的递阶段

import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';

/**
 * 比较fiberNode和ReactElement，返回子fiberNode
 */
export const beginWork = (wip: FiberNode) => {
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}
	return null;
};

function updateFunctionComponent(wip: FiberNode) {
	const nextChildren = renderWithHooks(wip);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateHostRoot(wip: FiberNode) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<ReactElementType | null>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	// 这里的memoizedState是ReactElementType
	const { memoizedState } = processUpdateQueue(baseState, pending);
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
		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		// mount（除了hostRootFiber）
		wip.child = mountChildFibers(wip, null, children);
	}
}
