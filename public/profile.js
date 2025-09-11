const SERVER_URL = 'http://localhost:3000';

async function loadProfile() {
  const res = await fetch(`${SERVER_URL}/profile`);
  if (res.status === 200) {
    const data = await res.json();
    document.getElementById('about').value = data.about || '';
    if (data.avatar) {
      document.getElementById('currentAvatar').src = SERVER_URL + data.avatar;
    }
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
  await fetch(`${SERVER_URL}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ about, avatarData, avatarName })
  });
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
