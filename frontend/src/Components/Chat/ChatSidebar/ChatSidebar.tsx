//React
import { useEffect, useMemo, useState } from 'react';
import { Users, Search } from 'lucide-react';

//Hooks
import useStore from '@/hooks/useStore';

//Utils
import { formatSidebarMessage } from '@/utils/messageFormat';
import { formatRelativeTime } from '@/utils/lastSentFormat';

import ChatSidebarSkeleton from './ChatSidebarLoading';

const ChatSidebar = () => {
  const {
    friends,
    fetchFriends,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    lastMessages,
    subscribeToMessages,
    unsubscribeFromMessages,
    loggedInMember, // Get current user info
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFriends().then(() => {
      subscribeToMessages();
    });

    return () => {
      unsubscribeFromMessages();
    };
  }, [fetchFriends, subscribeToMessages, unsubscribeFromMessages]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFriends = Array.isArray(friends) ? friends : [];

  const filteredFriends = useMemo(() => {
    const query = searchQuery.toLowerCase();
    // Use safeFriends here instead of friends
    return safeFriends.filter((friend) =>
      `${friend?.firstName || ''} ${friend?.lastName || ''} ${friend?.username || ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [safeFriends, searchQuery]);

  const sortedFriends = useMemo(() => {
    // Defensive check on lastMessages as well using optional chaining
    return [...filteredFriends].sort((a, b) => {
      const timestampA = lastMessages?.[a._id]?.createdAt;
      const timestampB = lastMessages?.[b._id]?.createdAt;

      const dateA = timestampA ? new Date(timestampA).getTime() : 0;
      const dateB = timestampB ? new Date(timestampB).getTime() : 0;

      return dateB - dateA;
    });
  }, [filteredFriends, lastMessages]);

  const getMessagePrefix = (message: any, friend: any) => {
    if (!message) return '';

    const isFromCurrentUser = message.senderId === loggedInMember?._id;

    if (isFromCurrentUser) {
      return 'Me: ';
    } else {
      return `${friend.firstName}: `;
    }
  };

  if (isUsersLoading) return <ChatSidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center gap-2">
          <Users className="size-6" />
          <span className="font-medium hidden lg:block">Contacts</span>
        </div>
      </div>

      {/* Search input section */}
      <div className="hidden lg:block p-3 border-b border-base-300">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            key="chat-search-input"
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-transparent border border-zinc-700 rounded-lg outline-none text-sm text-foreground placeholder-zinc-500 focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3 flex-1">
        {sortedFriends.map((friend) => {
          const lastMessage = lastMessages[friend._id];
          const messagePrefix = getMessagePrefix(lastMessage, friend);

          return (
            <button
              key={friend._id}
              onClick={() => setSelectedUser(friend)}
              className={`
                w-full p-3 flex items-center gap-3
                 transition-colors rounded-l-xl hover:bg-[#3a3b3c5f]
                ${
                  selectedUser?._id === friend._id
                    ? 'bg-gray-300 dark:bg-[oklch(0.22_0.015_285)]'
                    : ''
                }
              `}
            >
              <div className="relative mx-auto lg:mx-0">
                <img
                  src={`${friend?.photo?.url}?tr=w-128,h-128,cm-round,cq-95,sh-20,q-95,f-auto`}
                  alt={friend.firstName[0]}
                  className="size-12 object-cover rounded-full"
                />
              </div>

              <div className="hidden lg:flex text-left min-w-0 flex-1 justify-between items-center">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{`${friend.firstName} ${friend.lastName}`}</div>
                  <div className="text-sm text-zinc-400 truncate">
                    {lastMessage && (
                      <>
                        <span className="font-medium">{messagePrefix}</span>
                        {formatSidebarMessage(lastMessage.text)}
                      </>
                    )}
                  </div>
                </div>
                <div className="text-xs text-zinc-500 ml-2 whitespace-nowrap">
                  {(() => {
                    const createdAt = lastMessage?.createdAt;
                    return createdAt ? formatRelativeTime(createdAt) : '';
                  })()}
                </div>
              </div>
            </button>
          );
        })}

        {sortedFriends.length === 0 && (
          <div className="text-center text-zinc-500 py-4">
            {searchQuery ? 'No contacts found' : 'No online users'}
          </div>
        )}
      </div>
    </aside>
  );
};
export default ChatSidebar;
