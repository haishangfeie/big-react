import {
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority,
	unstable_getCurrentPriorityLevel
} from 'scheduler';
import { FiberRootNode } from './fiber';

/**
 * lane可以作为update的优先级
 */
export type Lane = number;
export type Lanes = number;

// !注意数值越小表示优先级越高(NoLane 0除外)
export const NoLane = /*                  */ 0b0000;
export const NoLanes = /*                 */ 0b0000;
export const SyncLane = /*                */ 0b0001;
export const InputContinuousLane = /*     */ 0b0010;
export const DefaultLane = /*             */ 0b0100;
export const IdleLane = /*                */ 0b1000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
	return laneA | laneB;
}

export function requestUpdateLane() {
	// 从上下文获取当前scheduler优先级
	const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
	const lane = schedulePriorityToLane(currentSchedulerPriority);

	return lane;
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
	// 值越小，对应的优先级越高（不包括0）
	return lanes & -lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}

export function lanesToSchedulerPriority(lanes: Lanes) {
	const lane = getHighestPriorityLane(lanes);

	if (lane === SyncLane) {
		return unstable_ImmediatePriority;
	}

	if (lane === InputContinuousLane) {
		return unstable_UserBlockingPriority;
	}

	if (lane === DefaultLane) {
		return unstable_NormalPriority;
	}

	return unstable_IdlePriority;
}

export function schedulePriorityToLane(schedulerPriority: number) {
	if (schedulerPriority === unstable_ImmediatePriority) {
		return SyncLane;
	}
	if (schedulerPriority === unstable_UserBlockingPriority) {
		return InputContinuousLane;
	}

	if (schedulerPriority === unstable_NormalPriority) {
		return DefaultLane;
	}

	return NoLane;
}

export function isSubsetOfLanes(set: Lanes, subSet: Lane) {
	return (set & subSet) === subSet;
}
