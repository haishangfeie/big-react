import { useState } from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
	const [num, setNum] = useState(1);

	return (
		<div
			onClick={() => {
				setNum((i) => i + 1);
				setNum((i) => i + 1);
				setNum((i) => i + 1);
			}}
		>
			{num}
		</div>
	);
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
