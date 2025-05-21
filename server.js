const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

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

    const fixtures = response.data.response;
    const uniqueLeagues = {};

    fixtures.forEach(match => {
      const league = match.league;
      if (!uniqueLeagues[league.id]) {
        uniqueLeagues[league.id] = {
          id: league.id,
          name: league.name,
          country: league.country
        };
      }
    });

    const leaguesList = Object.values(uniqueLeagues);
    res.json(leaguesList);
  } catch (err) {
    console.error('Erro ao buscar ligas do dia:', err.message);
    res.status(500).json({ error: 'Erro ao buscar ligas' });
  }
});

app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
