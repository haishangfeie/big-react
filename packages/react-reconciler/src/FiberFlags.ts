export type Flags = number;
export const NoFlags = 0b0000000;
export const Placement = 0b0000001;
export const Update = 0b0000010;
export const ChildDeletion = 0b0000100;

/** 标识当前fiber存在effect副作用
 * 具体是哪种副作用需要通过effect.tag确认
 */
export const PassiveEffect = 0b0001000;

export const MutationMask = Placement | Update | ChildDeletion;

/** 触发useEffect的情况 */
export const PassiveMask = PassiveEffect | ChildDeletion;
