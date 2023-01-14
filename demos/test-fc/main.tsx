import ReactDOM from 'react-dom/client';
import { useState } from 'react';

const App = () => {
	const [num, setNum] = useState(100);
	window.setNum = setNum;
	return <div>{num}</div>;
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
