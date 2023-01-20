import ReactDOM from 'react-dom/client';
import { useState } from 'react';

const App = () => {
	const [num, setNum] = useState(100);
	return (
		<div
			onClickCapture={() => {
				setNum((i) => ++i);
			}}
		>
			{num}
		</div>
	);
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
