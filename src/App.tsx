import MainApp from './MainApp';
import { ToastProvider } from './shared/Toast';
import { useGlobalErrorCatcher } from './hooks/useGlobalErrorCatcher';

export default function App() {
  useGlobalErrorCatcher();

  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
