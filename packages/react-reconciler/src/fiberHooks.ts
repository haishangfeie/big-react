import internals from 'shared/internals';
import { FiberNode } from './fiber';

let currentlyRenderingFiber: FiberNode | null = null;
const workInProgressHook: Hook | null = null;

const { currentDispatcher } = internals;

interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

export function renderWithHooks(wip: FiberNode) {
	currentlyRenderingFiber = wip;
	wip.memoizedState = null;

	const current = wip.alternate;
	if (current !== null) {
		// update
	} else {
		// mount
		// TODO
		currentDispatcher.current = {} as any;
	}

	const Component = wip.type;
	const props = wip.pendingProps;

	const children = Component(props);

	// 重置
	currentlyRenderingFiber = null;
	return children;
}
