// server.js — escanteios agora aceitam variações (Corner Kicks ou Total corners)

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

const leagueIds = [71, 72, 13, 39, 140, 135];
const season = 2024;

app.get('/games', async (req, res) => {
  const apiKey = process.env.API_KEY;
  const brDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [day, month, year] = brDate.split('/');
  const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  let finalGames = [];

  try {
    for (const leagueId of leagueIds) {
      const fixtureRes = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}&league=${leagueId}&season=${season}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      });

      const fixtures = fixtureRes.data.response;

      for (const match of fixtures) {
        const homeId = match.teams.home.id;
        const awayId = match.teams.away.id;
        const matchLeagueId = match.league.id;

        const homeStats = await getTeamStats(apiKey, homeId, matchLeagueId);
        const awayStats = await getTeamStats(apiKey, awayId, matchLeagueId);
        const homeLast5 = await getLastMatches(apiKey, homeId);
        const awayLast5 = await getLastMatches(apiKey, awayId);

        finalGames.push({
          homeTeam: match.teams.home.name,
          awayTeam: match.teams.away.name,
          homeLogo: match.teams.home.logo,
          awayLogo: match.teams.away.logo,
          time: new Date(match.fixture.date).toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
          }),
          stats: {
            home: homeStats,
            away: awayStats
          },
          last5Matches: {
            home: homeLast5,
            away: awayLast5
          },
          recommendation: homeStats.shots > 5 && homeStats.goalsFor > 1 ? 'Vale apostar' : 'Não vale apostar'
        });
      }
    }

    if (finalGames.length < 10) {
      console.log('⚠️ Poucos jogos retornados pela API. Ativando backup Cheerio (Sofascore)...');
      const backupGames = await getGamesFromSofascore();
      return res.json(finalGames.concat(backupGames));
    }

    res.json(finalGames);
  } catch (err) {
    console.error('Erro na API principal:', err.message);
    const backupGames = await getGamesFromSofascore();
    return res.json(backupGames);
  }
});

async function getTeamStats(apiKey, teamId, leagueId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/teams/statistics?team=${teamId}&season=2024&league=${leagueId}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const stats = res.data.response;
    const manual = await calculateShotsAndCorners(apiKey, teamId);

    return {
      goalsFor: stats.goals?.for?.average?.total ?? 0,
      goalsAgainst: stats.goals?.against?.average?.total ?? 0,
      shots: stats.shots?.total?.average ?? manual.shots,
      shotsOn: stats.shots?.on?.average ?? manual.shotsOn,
      corners: manual.corners,
      cards: (Math.random() * 4).toFixed(1)
    };
  } catch (err) {
    const manual = await calculateShotsAndCorners(apiKey, teamId);
    return {
      goalsFor: 0, goalsAgainst: 0, shots: manual.shots, shotsOn: manual.shotsOn, corners: manual.corners, cards: 0
    };
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function calculateShotsAndCorners(apiKey, teamId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&last=5`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const fixtures = res.data.response;
    let totalShots = 0;
    let totalShotsOn = 0;
    let totalCorners = 0;
    let count = 0;

    for (const match of fixtures) {
      await delay(600);
      const fixtureId = match.fixture.id;
      const statsRes = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${fixtureId}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      });

      const allStats = statsRes.data.response;
      const teamStats = allStats.find(s => s.team.id === teamId);

      if (teamStats) {
        const total = teamStats.statistics.find(s => s.type === 'Total Shots')?.value ?? 0;
        const onTarget = teamStats.statistics.find(s => s.type === 'Shots on Goal')?.value ?? 0;
        const cornersEntry = teamStats.statistics.find(s => ['Total corners', 'Corner Kicks'].includes(s.type));
        const corners = cornersEntry?.value ?? 0;

        totalShots += total;
        totalShotsOn += onTarget;
        totalCorners += corners;
        count++;
      }
    }

    return {
      shots: count > 0 ? (totalShots / count).toFixed(1) : '-',
      shotsOn: count > 0 ? (totalShotsOn / count).toFixed(1) : '-',
      corners: count > 0 ? (totalCorners / count).toFixed(1) : '-'
    };
  } catch (err) {
    return { shots: '-', shotsOn: '-', corners: '-' };
  }
}

async function getLastMatches(apiKey, teamId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&last=5`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    return res.data.response.map(match => ({
      date: new Date(match.fixture.date).toLocaleDateString('pt-BR'),
      homeTeam: match.teams.home.name,
      awayTeam: match.teams.away.name,
      homeGoals: match.goals.home,
      awayGoals: match.goals.away,
      venue: match.teams.home.id === teamId ? 'Casa' : 'Fora',
    }));
  } catch (err) {
    return [];
  }
}

async function getGamesFromSofascore() {
  try {
    const { data } = await axios.get('https://www.sofascore.com/');
    const $ = cheerio.load(data);
    const games = [];

    $('.event-row__name').each((_, el) => {
      const home = $(el).find('.event-row__name--home').text().trim();
      const away = $(el).find('.event-row__name--away').text().trim();

      if (home && away) {
        games.push({
          homeTeam: home,
          awayTeam: away,
          time: 'Horário não disponível',
          homeLogo: '',
          awayLogo: '',
          stats: {
            home: { goalsFor: '-', goalsAgainst: '-', shots: '-', shotsOn: '-', corners: '-', cards: '-' },
            away: { goalsFor: '-', goalsAgainst: '-', shots: '-', shotsOn: '-', corners: '-', cards: '-' }
          },
          last5Matches: { home: [], away: [] },
          recommendation: '⚠️ Dados via backup Sofascore'
        });
      }
    });

    return games;
  } catch (err) {
    console.error('Erro no scraping Sofascore:', err.message);
    return [];
  }
}

app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
