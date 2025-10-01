import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ArmySidebar from "components/army/ArmySidebar";

function makeRef() {
  // Simple ref object; React will replace .current with the DOM node, which is fine for these tests
  return { current: null };
}
describe("ArmySidebar", () => {
  test("renders header and Replace button when hasArmy is true (Player A)", () => {
    const inputRef = makeRef();
    render(
      <ArmySidebar
        columnKey="A"
        displayName="Alice"
        inputRef={inputRef}
        hasArmy={true}
        uploadError=""
        onFileInputChange={jest.fn()}
        onDragOverZone={jest.fn()}
        onDropZone={jest.fn()}
      >
        <div>children</div>
      </ArmySidebar>,
    );

    expect(
      screen.getByRole("heading", { name: /Player A/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Replace army/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Upload army file dropzone for Player A/i),
    ).not.toBeInTheDocument();
  });

  test("renders dropzone when hasArmy is false and propagates onFileInputChange", () => {
    const onChange = jest.fn();
    const inputRef = makeRef();
    render(
      <ArmySidebar
        columnKey="B"
        displayName="Bob"
        inputRef={inputRef}
        hasArmy={false}
        uploadError="Oops"
        onFileInputChange={onChange}
        onDragOverZone={jest.fn()}
        onDropZone={jest.fn()}
      />,
    );

    // Dropzone visible for Player B
    expect(
      screen.getByLabelText(/Upload army file dropzone for Player B/i),
    ).toBeInTheDocument();

    // Hidden file input exists and change calls handler with columnKey
    const fileInput = screen.getByLabelText(/Upload army file for Player B/i);
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["{}"], "x.json", { type: "application/json" })],
      },
    });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toBe("B");
  });
});
