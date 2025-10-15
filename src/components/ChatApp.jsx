import { useState } from "react";
import ChatList from "./ChatList.jsx";
import ChatView from "./ChatView.jsx";

export default function ChatApp() {
  const [selected, setSelected] = useState(null);
  return (
    <div className="h-screen flex bg-gray-100">
      <aside className="w-80 bg-white border-r">
        <ChatList onSelect={setSelected} />
      </aside>
      <main className="flex-1">
        <ChatView conversation={selected} />
      </main>
    </div>
  );
}
