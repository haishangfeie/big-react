import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatcher, Dispatch } from 'react/src/currentDispatcher';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
import { PassiveEffect } from './FiberFlags';
import { EffectTag, HookHasEffect, Passive } from './hookEffectTags';

/** 当前渲染的wip fiber */
let currentlyRenderingFiber: FiberNode | null = null;
/** wip指向的hook */
let workInProgressHook: Hook | null = null;
/** current fiber指向的hook */
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;

interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

export interface Effect {
	tag: EffectTag;
	create: EffectCallback | void;
	destroy: EffectCallback | void;
	deps: EffectDeps | void;
	next: Effect | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	// 环状链表，指向effect链表的最后一个，next指向的就是第一个effect
	lastEffect: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

export function renderWithHooks(wip: FiberNode, lane: Lane) {
	currentlyRenderingFiber = wip;
	// 重置
	wip.memoizedState = null; // 重置hook链表
	wip.updateQueue = null; // 重置effect链表
	renderLane = lane;

	const current = wip.alternate;
	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);
	// 重置
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	renderLane = NoLane;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect
};

function updateState<State>(): [State, Dispatch<State>] {
	const hook = updateWorkInProgressHook();
	const queue = hook.updateQueue as UpdateQueue<State>;
	const { pending } = queue.shared;
	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(
			hook.memoizedState,
			pending,
			renderLane
		);
		hook.memoizedState = memoizedState;
	}
	queue.shared.pending = null;
	return [hook.memoizedState, queue.dispatch!];
}

function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	const hook = mountWorkInProgressHook();
	let memoizedState: State | undefined;
	if (initialState instanceof Function) {
		memoizedState = initialState();
	} else {
		memoizedState = initialState;
	}
	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	hook.memoizedState = memoizedState;
	// 如果currentlyRenderingFiber不存在，在mountWorkInProgressHook就已经报错了，所以走到这一步，该变量一定存在
	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber!, queue);
	queue.dispatch = dispatch;

	return [memoizedState, dispatch];
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLane();
	const update = createUpdate(action, lane);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		next: null,
		updateQueue: null
	};
	// mount时是第一个hook
	if (workInProgressHook === null) {
		// 判断hook是否在React函数或者hook中使用
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		} else {
			workInProgressHook = hook;
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// mount时，不是第一个hook
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}

	return workInProgressHook;
}

function updateWorkInProgressHook(): Hook {
	// TODO: render阶段触发更新的情况未处理
	let nextCurrentHook: Hook | null = null;

	if (currentHook === null) {
		// 这是这个FC update时的第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		}
		// 这时hook数据就要从currentFiber中获取
		const current = currentlyRenderingFiber.alternate;
		if (current) {
			nextCurrentHook = current.memoizedState;
		} else {
			// 这种属于异常情况 current不存在应该是mount阶段，不应该会调用这个update阶段的方法
			nextCurrentHook = null;
			throw new Error('update阶段不应该进入此逻辑');
		}
	} else {
		// FC update时后续的hook
		nextCurrentHook = currentHook.next;
	}

	// 有两种可能这时为null,
	// 1. 上面的current不存在
	// 2. 原来调用的hook少于当前调用的hook，例如之前的mount/update用到的hook为:hook1,hook2,hook3，结果这次hook为:hook1,hook2,hook3,hook4，hook数对不上，这显然是异常的
	// 第二种情况出现的原因，例如在if语句里面使用useState，这就可以导致hook的调用对不上
	if (nextCurrentHook === null) {
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的hook比上次执行时多`
		);
	}

	currentHook = nextCurrentHook;
	const newHook: Hook = {
		memoizedState: currentHook?.memoizedState || null,
		updateQueue: currentHook?.updateQueue || null,
		next: null
	};

	if (workInProgressHook === null) {
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		} else {
			workInProgressHook = newHook;
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// update时，不是第一个hook
		workInProgressHook.next = newHook;
		workInProgressHook = newHook;
	}

	return workInProgressHook;
}

/* effect */
function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	const hook = mountWorkInProgressHook();

	const nextDeps = deps === undefined ? null : deps;
	if (currentlyRenderingFiber) {
		currentlyRenderingFiber.flags |= PassiveEffect;
	} else {
		throw new Error('请在函数组件内调用hook');
	}
	hook.memoizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		// mount是没有destroy的
		undefined,
		nextDeps
	);
}

function pushEffect(
	hookFlags: EffectTag,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps | void
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	};
	const fiber = currentlyRenderingFiber as FiberNode;
	let updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue === null) {
		updateQueue = fiber.updateQueue = createFCUpdateQueue();
		effect.next = effect;
		updateQueue.lastEffect = effect;
	} else {
		const lastEffect = updateQueue.lastEffect;
		if (lastEffect === null) {
			effect.next = effect;
			updateQueue.lastEffect = effect;
		} else {
			effect.next = lastEffect!.next;
			lastEffect!.next = effect;
			updateQueue.lastEffect = effect;
		}
	}
	return effect;
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	let destroy: EffectCallback | void;
	if (currentHook !== null) {
		const prevEffect = currentHook.memoizedState;
		destroy = prevEffect.destroy;
		if (nextDeps !== null) {
			// 浅比较依赖
			const prevDeps = prevEffect.deps;
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
				return;
			}
		}
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		}
		currentlyRenderingFiber.flags |= PassiveEffect;
		hook.memoizedState = pushEffect(
			Passive | HookHasEffect,
			create,
			destroy,
			nextDeps
		);
		return;
	} else {
		currentHook = hook;
	}
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	if (prevDeps === null || nextDeps === null) {
		return false;
	}

	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue;
		}
		return false;
	}
	return true;
}
