import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { prepareStorage } from "./lib/storage";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <div
          style={{
            fontFamily: "system-ui",
            maxWidth: 600,
            margin: "15vh auto",
            padding: 24,
          }}
        >
          <h1>Не удалось открыть приложение</h1>
          <p>
            Ваш сохранённый прогресс остаётся на устройстве. Попробуйте
            перезапустить приложение.
          </p>
          <button onClick={() => location.reload()}>Перезагрузить</button>
        </div>
      );
    return this.props.children;
  }
}
await prepareStorage();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
