import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders meeting intelligence screen", () => {
  render(<App />);
  expect(screen.getByText(/meeting intelligence/i)).toBeInTheDocument();
});
