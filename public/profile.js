const SERVER_URL = 'http://localhost:3000';

async function loadProfile() {
  const res = await fetch(`${SERVER_URL}/profile`);
  if (res.status === 200) {
    const data = await res.json();
    document.getElementById('about').value = data.about || '';
    const avatar = data.avatar ? SERVER_URL + data.avatar : 'https://via.placeholder.com/100';
    document.getElementById('currentAvatar').src = avatar;
  }
}

document.getElementById('profileForm').onsubmit = async e => {
  e.preventDefault();
  const about = document.getElementById('about').value;
  const file = document.getElementById('avatarInput').files[0];
  let avatarData = null, avatarName = null;
  if (file) {
    const b64 = await fileToBase64(file);
    avatarData = b64.split(',')[1];
    avatarName = file.name;
  }
  const resp = await fetch(`${SERVER_URL}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ about, avatarData, avatarName })
  });
  const result = await resp.json();
  const newAvatar = result.avatar ? SERVER_URL + result.avatar : 'https://via.placeholder.com/100';
  document.getElementById('currentAvatar').src = newAvatar;
  alert('Profile saved!');
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

loadProfile();
