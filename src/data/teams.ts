import type { Team } from './types'

// All 32 NFL teams. IDs/colors pulled from ESPN's public teams endpoint
// (site.api.espn.com/apis/site/v2/sports/football/nfl/teams); conference/
// division is hardcoded since it rarely changes and isn't exposed cleanly
// by that endpoint.
export const TEAMS: Team[] = [
  { id: '22', abbr: 'ARI', name: 'Cardinals', location: 'Arizona', conference: 'NFC', division: 'West', colorPrimary: '#a40227', colorSecondary: '#ffffff' },
  { id: '1', abbr: 'ATL', name: 'Falcons', location: 'Atlanta', conference: 'NFC', division: 'South', colorPrimary: '#a71930', colorSecondary: '#000000' },
  { id: '33', abbr: 'BAL', name: 'Ravens', location: 'Baltimore', conference: 'AFC', division: 'North', colorPrimary: '#29126f', colorSecondary: '#000000' },
  { id: '2', abbr: 'BUF', name: 'Bills', location: 'Buffalo', conference: 'AFC', division: 'East', colorPrimary: '#00338d', colorSecondary: '#d50a0a' },
  { id: '29', abbr: 'CAR', name: 'Panthers', location: 'Carolina', conference: 'NFC', division: 'South', colorPrimary: '#0085ca', colorSecondary: '#000000' },
  { id: '3', abbr: 'CHI', name: 'Bears', location: 'Chicago', conference: 'NFC', division: 'North', colorPrimary: '#0b1c3a', colorSecondary: '#e64100' },
  { id: '4', abbr: 'CIN', name: 'Bengals', location: 'Cincinnati', conference: 'AFC', division: 'North', colorPrimary: '#fb4f14', colorSecondary: '#000000' },
  { id: '5', abbr: 'CLE', name: 'Browns', location: 'Cleveland', conference: 'AFC', division: 'North', colorPrimary: '#472a08', colorSecondary: '#ff3c00' },
  { id: '6', abbr: 'DAL', name: 'Cowboys', location: 'Dallas', conference: 'NFC', division: 'East', colorPrimary: '#002a5c', colorSecondary: '#b0b7bc' },
  { id: '7', abbr: 'DEN', name: 'Broncos', location: 'Denver', conference: 'AFC', division: 'West', colorPrimary: '#0a2343', colorSecondary: '#fc4c02' },
  { id: '8', abbr: 'DET', name: 'Lions', location: 'Detroit', conference: 'NFC', division: 'North', colorPrimary: '#0076b6', colorSecondary: '#bbbbbb' },
  { id: '9', abbr: 'GB', name: 'Packers', location: 'Green Bay', conference: 'NFC', division: 'North', colorPrimary: '#204e32', colorSecondary: '#ffb612' },
  { id: '34', abbr: 'HOU', name: 'Texans', location: 'Houston', conference: 'AFC', division: 'South', colorPrimary: '#021018', colorSecondary: '#eb0028' },
  { id: '11', abbr: 'IND', name: 'Colts', location: 'Indianapolis', conference: 'AFC', division: 'South', colorPrimary: '#003b75', colorSecondary: '#ffffff' },
  { id: '30', abbr: 'JAX', name: 'Jaguars', location: 'Jacksonville', conference: 'AFC', division: 'South', colorPrimary: '#007487', colorSecondary: '#d7a22a' },
  { id: '12', abbr: 'KC', name: 'Chiefs', location: 'Kansas City', conference: 'AFC', division: 'West', colorPrimary: '#e31837', colorSecondary: '#ffb612' },
  { id: '24', abbr: 'LAC', name: 'Chargers', location: 'Los Angeles', conference: 'AFC', division: 'West', colorPrimary: '#0080c6', colorSecondary: '#ffc20e' },
  { id: '14', abbr: 'LAR', name: 'Rams', location: 'Los Angeles', conference: 'NFC', division: 'West', colorPrimary: '#003594', colorSecondary: '#ffd100' },
  { id: '13', abbr: 'LV', name: 'Raiders', location: 'Las Vegas', conference: 'AFC', division: 'West', colorPrimary: '#000000', colorSecondary: '#a5acaf' },
  { id: '15', abbr: 'MIA', name: 'Dolphins', location: 'Miami', conference: 'AFC', division: 'East', colorPrimary: '#008e97', colorSecondary: '#fc4c02' },
  { id: '16', abbr: 'MIN', name: 'Vikings', location: 'Minnesota', conference: 'NFC', division: 'North', colorPrimary: '#4f2683', colorSecondary: '#ffc62f' },
  { id: '17', abbr: 'NE', name: 'Patriots', location: 'New England', conference: 'AFC', division: 'East', colorPrimary: '#002a5c', colorSecondary: '#c60c30' },
  { id: '18', abbr: 'NO', name: 'Saints', location: 'New Orleans', conference: 'NFC', division: 'South', colorPrimary: '#d3bc8d', colorSecondary: '#000000' },
  { id: '19', abbr: 'NYG', name: 'Giants', location: 'New York', conference: 'NFC', division: 'East', colorPrimary: '#003c7f', colorSecondary: '#c9243f' },
  { id: '20', abbr: 'NYJ', name: 'Jets', location: 'New York', conference: 'AFC', division: 'East', colorPrimary: '#115740', colorSecondary: '#ffffff' },
  { id: '21', abbr: 'PHI', name: 'Eagles', location: 'Philadelphia', conference: 'NFC', division: 'East', colorPrimary: '#06424d', colorSecondary: '#000000' },
  { id: '23', abbr: 'PIT', name: 'Steelers', location: 'Pittsburgh', conference: 'AFC', division: 'North', colorPrimary: '#000000', colorSecondary: '#ffb612' },
  { id: '26', abbr: 'SEA', name: 'Seahawks', location: 'Seattle', conference: 'NFC', division: 'West', colorPrimary: '#002a5c', colorSecondary: '#69be28' },
  { id: '25', abbr: 'SF', name: '49ers', location: 'San Francisco', conference: 'NFC', division: 'West', colorPrimary: '#aa0000', colorSecondary: '#b3995d' },
  { id: '27', abbr: 'TB', name: 'Buccaneers', location: 'Tampa Bay', conference: 'NFC', division: 'South', colorPrimary: '#bd1c36', colorSecondary: '#3e3a35' },
  { id: '10', abbr: 'TEN', name: 'Titans', location: 'Tennessee', conference: 'AFC', division: 'South', colorPrimary: '#4495d2', colorSecondary: '#001532' },
  { id: '28', abbr: 'WSH', name: 'Commanders', location: 'Washington', conference: 'NFC', division: 'East', colorPrimary: '#5a1414', colorSecondary: '#ffb612' },
]

export const TEAMS_BY_ID: Record<string, Team> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t])
)

export const TEAMS_BY_ABBR: Record<string, Team> = Object.fromEntries(
  TEAMS.map((t) => [t.abbr, t])
)

export const BROWNS_TEAM_ID = TEAMS_BY_ABBR['CLE'].id
