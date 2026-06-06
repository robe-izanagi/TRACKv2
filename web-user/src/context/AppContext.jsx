import React, { createContext } from "react";
export const AppContext = createContext({});
export function AppProvider({children}){ return <AppContext.Provider value={{}}>{children}</AppContext.Provider>; }
