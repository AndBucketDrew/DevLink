import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
} from '@/Components/ui';
import { useEffect, useState } from 'react';
import { BellIcon } from 'lucide-react';
import useStore from '@/hooks/useStore';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function Notifications() {
  const {
    notifications,
    unreadCount,
    getNotifications,
    markAsRead,
    markAllAsRead,
    subscribeToNotifications,
  } = useStore((state) => state);

  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  useEffect(() => {
    getNotifications();

    const { socket } = useStore.getState();
    if (socket?.connected) {
      subscribeToNotifications();
    }

    //   return () => unsubscribeFromNotifications();
  }, []);

  const handleNotificationClick = (n: any) => {
    markAsRead(n._id);

    switch (n.type) {
      case 'comment':
      case 'like':
        if (n.relatedPost?._id) {
          navigate(`/posts/${n.relatedPost._id}`);
        }
        break;
      case 'friend_request':
      case 'friend_accept':
        if (n.fromUser?._id) {
          navigate(`/members/${n.fromUser.username}`);
        }
        break;
      default:
        console.warn('Unknown notification type', n.type);
    }

    setOpen(false); // close dropdown after click
  };
  //   useEffect(() => {
  //     if (open && unreadCount > 0) markAllAsRead();
  //   }, [open]);

  return (
    <DropdownMenu open={open} modal={false} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="notifications-bell"
          className="relative hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-medium rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 p-2 dark:bg-gray-900 bg-white shadow-lg rounded-xl"
      >
        <DropdownMenuLabel className="flex justify-between items-center">
          <span className="font-semibold text-foreground">Notifications</span>
          {unreadCount > 0 && (
            <Button
              onClick={markAllAsRead}
              className="bg-transparent border-transparent text-foreground text-sm"
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-4">No notifications yet</p>
          )}

          {notifications.map((n) => (
            <DropdownMenuItem
              key={n._id}
              onClick={() => handleNotificationClick(n)}
              className={cn(
                'flex items-center gap-3 py-2 cursor-pointer',
                !n.isRead ? 'bg-blue-50 dark:bg-gray-800' : '',
              )}
            >
              <Avatar className="w-10 h-10">
                <AvatarImage
                  src={`${n.fromUser?.photo?.url}?tr=w-128,h-128,cm-round,cq-95,sh-20,q-95,f-auto`}
                  alt={n.fromUser?.username}
                  className="w-full h-full object-cover"
                />
                <AvatarFallback>{n.fromUser?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <p className="text-sm text-gray-800 dark:text-gray-200">{n.message}</p>
                <p className="text-xs text-gray-500">
                  {new Date(n.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
