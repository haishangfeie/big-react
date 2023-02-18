import { Container } from 'hostConfig';
import { Props } from 'shared/ReactTypes';

interface Paths {
	capture: EventCallback[];
	bubble: EventCallback[];
}

type EventCallback = (e: Event) => void;

export const elementPropsKey = '__props';

export interface DOMElement extends Element {
	[elementPropsKey]: Props;
}

interface SyntheticEvent extends Event {
	// 是否阻止事件传递
	__stopPropagation: boolean;
}

const validEventTypeList = ['click'];

export function updateFiberProps(node: DOMElement, props: Props) {
	node[elementPropsKey] = props;
	return node;
}

export function initEvent(container: Container, eventType: string) {
	if (!validEventTypeList.includes(eventType)) {
		console.warn('当前不支持', eventType, '事件');
		return;
	}
	if (__DEV__) {
		console.log('初始化事件', eventType);
	}
	container.addEventListener(eventType, (e) => {
		dispatchEvent(container, eventType, e);
	});
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
	/*
	 *    1. 收集从targetElement到container途径所有事件
	 *    2. 构造合成事件
	 *    3. 遍历capture
	 *    4. 遍历bubble
	 */
	const targetElement = e.target as DOMElement;
	if (targetElement === null) {
		console.warn('事件不存在target', e);
		return;
	}

	// 1. 收集从targetElement到container途径所有事件
	const { bubble, capture } = collectPaths(targetElement, container, eventType);

	// 2. 构造合成事件
	const se = createSyntheticEvent(e);

	// 3. 遍历capture
	triggerEventFlow(capture, se);

	if (!se.__stopPropagation) {
		// 4. 遍历bubble
		triggerEventFlow(bubble, se);
	}
}

function getEventCallbackNameFromEventType(
	eventType: string
): string[] | undefined {
	return {
		// ! 这里的顺序是有要求的，第一项是捕获，第二项是冒泡
		click: ['onClickCapture', 'onClick']
	}[eventType];
}

function collectPaths(
	targetElement: DOMElement,
	container: Container,
	eventType: string
) {
	const paths: Paths = {
		capture: [],
		bubble: []
	};
	let node: DOMElement | null = targetElement;
	while (node && node !== container) {
		const elementProps = node[elementPropsKey];
		if (elementProps) {
			const callbackNameList = getEventCallbackNameFromEventType(eventType);
			if (callbackNameList) {
				callbackNameList.forEach((callbackName, i) => {
					const eventCallback = elementProps[callbackName];
					if (eventCallback) {
						if (i === 0) {
							paths.capture.unshift(eventCallback);
						} else {
							paths.bubble.push(eventCallback);
						}
					}
				});
			}
		}
		node = node.parentNode as DOMElement | null;
	}

	return paths;
}

function createSyntheticEvent(e: Event): SyntheticEvent {
	const syntheticEvent = e as SyntheticEvent;
	syntheticEvent.__stopPropagation = false;
	const originStopPropagation = e.stopPropagation;

	syntheticEvent.stopPropagation = () => {
		syntheticEvent.__stopPropagation = true;
		if (originStopPropagation) {
			originStopPropagation();
		}
	};
	return syntheticEvent;
}

function triggerEventFlow(eventCallbacks: EventCallback[], se: SyntheticEvent) {
	for (let i = 0; i < eventCallbacks.length; i++) {
		const cb = eventCallbacks[i];
		cb.call(null, se);
		if (se.__stopPropagation) {
			break;
		}
	}
}
