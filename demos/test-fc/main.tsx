import ReactDOM from 'react-dom/client';
import { useState } from 'react';

const App = () => {
	const [num, setNum] = useState(100);
	window.setNum = setNum;
	return num === 3 ? <Child /> : <div>{num}</div>;
};
const Child = () => <span>big-react</span>;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
