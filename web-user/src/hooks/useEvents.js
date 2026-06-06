import { useState, useEffect } from "react";
export default function useEvents(){ const [list, setList] = useState([]); useEffect(()=>{},[]); return {list,setList}; }
