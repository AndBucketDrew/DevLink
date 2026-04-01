import Logo from '@/assets/DevLinkLogo.png';

import { useStore } from '@/hooks';
import { useNavigate } from 'react-router-dom';

export default function AppNameAndLogo() {
  const { fetchFriendsPosts } = useStore();
  const navigate = useNavigate();

  const handleHomeClick = () => {
    if (location.pathname === '/') {
      // already on homepage → scroll + refresh
      window.scrollTo({ top: 0, behavior: 'smooth' });
      fetchFriendsPosts(); // reload posts
    } else {
      // navigate normally
      navigate('/');
    }
  };

  return (
    <div className="font-poppins flex items-center gap-2 ">
      {/* Logo with Link */}
      <button onClick={handleHomeClick} aria-label="go-to-home">
        <div className="flex justify-center items-center">
          <img src={Logo} alt="Logo" className="min-h-6 min-w-6 max-h-6 max-w-6 " />
        </div>
        {/* Container for the name */}
        <div className="flex gap-1 items-center text-xl">
          <span>
            Dev<strong>Link</strong>
          </span>
        </div>
      </button>
    </div>
  );
}
