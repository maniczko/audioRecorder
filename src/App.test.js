import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders VoiceLog header", () => {
  render(<App />);
  expect(screen.getByText(/voicelog/i)).toBeInTheDocument();
});
