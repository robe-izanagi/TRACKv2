import { createContext, useContext, useState, useCallback } from "react";

const FeedbackSheetContext = createContext();

export const FeedbackSheetProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openFeedback = useCallback(() => setIsOpen(true), []);
  const closeFeedback = useCallback(() => setIsOpen(false), []);

  return (
    <FeedbackSheetContext.Provider value={{ isOpen, openFeedback, closeFeedback }}>
      {children}
    </FeedbackSheetContext.Provider>
  );
};

export const useFeedbackSheet = () => useContext(FeedbackSheetContext);