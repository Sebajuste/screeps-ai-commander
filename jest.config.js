module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'screeps-jest',
  transform: {
    "^.+\\.(ts)$": "ts-jest",
    "^.+\\.(js)$": "babel-jest",
  }
};