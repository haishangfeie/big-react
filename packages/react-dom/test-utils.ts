// @ts-ignore
import ReactDom from 'react-dom';
import { ReactElementType } from 'shared/ReactTypes';

export function renderIntoDocument(element: ReactElementType) {
	const div = document.createElement('div');
	return ReactDom.createRoot(div).render(element);
}
