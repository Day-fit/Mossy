import type { ReactNode } from "react";
import {
  PopupControllerContext,
  usePopupControllerValue,
} from "../hooks/usePopupController";

type Props = {
  children: ReactNode;
};

export default function PopupControllerProvider({ children }: Props) {
  const value = usePopupControllerValue();

  return (
    <PopupControllerContext.Provider value={value}>
      {children}
    </PopupControllerContext.Provider>
  );
}
