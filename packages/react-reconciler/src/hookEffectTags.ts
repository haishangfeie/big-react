export type EffectTag = number;

/**
 * 标识effect为useEffect对应的副作用
 */
export const Passive = 0b0010; // 用于uesEffect

/**
 * 标识effect在本次更新中存在副作用
 */
export const HookHasEffect = 0b0001;

export const NoEffect = 0b0000;
