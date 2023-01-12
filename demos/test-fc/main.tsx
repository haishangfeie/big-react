import ReactDOM from 'react-dom/index';

const App = () => {
	return (
		<div>
			<Child />
		</div>
	);
};
const Child = () => <span>child</span>;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
