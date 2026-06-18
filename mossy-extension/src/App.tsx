import PopupContent from "./components/PopupContent";
import PopupControllerProvider from "./components/PopupControllerProvider";
import ExtensionStoreProvider from "./store/ExtensionStoreProvider";

export default function App() {
  return (
    <ExtensionStoreProvider>
      <PopupControllerProvider>
        <PopupContent />
      </PopupControllerProvider>
    </ExtensionStoreProvider>
  );
}
