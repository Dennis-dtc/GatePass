import { useEffect, useState } from "react";
import { useNotification } from "../context/NotificationContext";

// A global resolver store (hacky but effective)
const dialog = {
  confirmResolve: null,
  promptResolve: null,
};

export default function OverrideDialogs() {
  const { notify } = useNotification();

  const [confirmMessage, setConfirmMessage] = useState(null);
  const [promptMessage, setPromptMessage] = useState(null);
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    // Override alert()
    const originalAlert = window.alert;
    window.alert = (msg) => {
      notify(String(msg), "error");
      // remove this if you never want browser alert:
      // originalAlert(msg);
    };

    // Override confirm()
    window.confirm = (message) => {
      return new Promise((resolve) => {
        dialog.confirmResolve = resolve;
        setConfirmMessage(String(message));
      });
    };

    // Override prompt()
    window.prompt = (message, defaultValue = "") => {
      return new Promise((resolve) => {
        dialog.promptResolve = resolve;
        setPromptMessage(String(message));
        setPromptValue(defaultValue);
      });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [notify]);

  // Confirm modal actions
  const confirmYes = () => {
    dialog.confirmResolve?.(true);
    setConfirmMessage(null);
  };
  const confirmNo = () => {
    dialog.confirmResolve?.(false);
    setConfirmMessage(null);
  };

  // Prompt modal actions
  const promptSubmit = () => {
    dialog.promptResolve?.(promptValue);
    setPromptMessage(null);
  };
  const promptCancel = () => {
    dialog.promptResolve?.(null);
    setPromptMessage(null);
  };

  return (
    <>
      {/* Confirm Modal */}
      {confirmMessage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]">
          <div className="bg-white p-5 rounded-xl shadow-xl w-80">
            <p className="font-semibold text-center mb-4">{confirmMessage}</p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={confirmYes}
                className="px-4 py-2 rounded bg-green-500 text-white"
              >
                Yes
              </button>
              <button
                onClick={confirmNo}
                className="px-4 py-2 rounded bg-gray-300"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {promptMessage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]">
          <div className="bg-white p-5 rounded-xl shadow-xl w-80">
            <p className="font-semibold text-center mb-3">{promptMessage}</p>

            <input
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="w-full border px-3 py-2 rounded mb-4"
            />

            <div className="flex gap-3 justify-center">
              <button
                onClick={promptSubmit}
                className="px-4 py-2 rounded bg-blue-500 text-white"
              >
                OK
              </button>
              <button
                onClick={promptCancel}
                className="px-4 py-2 rounded bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
