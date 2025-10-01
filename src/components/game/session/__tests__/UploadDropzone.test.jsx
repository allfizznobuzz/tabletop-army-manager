import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import UploadDropzone from "components/game/session/UploadDropzone";

describe("UploadDropzone", () => {
  test("renders with error and calls handlers", () => {
    const onDragOver = jest.fn((e) => e.preventDefault());
    const onDrop = jest.fn((e) => e.preventDefault());
    const onClick = jest.fn();

    render(
      <UploadDropzone
        columnKey="A"
        inputRef={{ current: null }}
        uploadError="Oops"
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={onClick}
      />,
    );

    const dz = screen.getByRole("button", {
      name: /Upload army file dropzone for Player A/i,
    });
    fireEvent.dragOver(dz);
    fireEvent.drop(dz);
    fireEvent.click(dz);

    expect(onDragOver).toHaveBeenCalled();
    expect(onDrop).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalled();

    expect(screen.getByText(/Oops/)).toBeInTheDocument();
  });
});
