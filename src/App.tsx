import MainApp from './MainApp';
import { ToastProvider } from './shared/Toast';

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
