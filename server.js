const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// === ROTA PARA JOGOS DO DIA (sem médias, só para teste) ===
app.get('/games', async (req, res) => {
  const apiKey = process.env.API_KEY;
  const brDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [day, month, year] = brDate.split('/');
  const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  try {
    const response = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const jogos = response.data.response.map(match => ({
      fixtureId: match.fixture.id,
      homeTeam: match.teams.home.name,
      awayTeam: match.teams.away.name,
      homeLogo: match.teams.home.logo,
      awayLogo: match.teams.away.logo,
      time: new Date(match.fixture.date).toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
      })
    }));

    res.json(jogos);
  } catch (err) {
    console.error('Erro ao buscar jogos:', err.message);
    res.status(500).json({ error: 'Erro ao buscar jogos' });
  }
});

// === ROTA PARA VER QUAIS LIGAS TÊM JOGOS HOJE ===
app.get('/leagues', async (req, res) => {
  const apiKey = process.env.API_KEY;
  const brDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [day, month, year] = brDate.split('/');
  const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  try {
    const response = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const leaguesToday = response.data.response.map(fix => ({
      league: fix.league.name,
      country: fix.league.country,
      id: fix.league.id
    }));

    const uniqueLeagues = leaguesToday.filter((obj, index, self) =>
      index === self.findIndex(t => t.id === obj.id)
    );

    res.json(uniqueLeagues);
  } catch (err) {
    console.error('Erro na rota /leagues:', err.message);
    res.status(500).json({ error: 'Erro ao buscar ligas' });
  }
});

// === INICIAR SERVIDOR ===
app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
