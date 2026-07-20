module.exports = {
  generateRandomEmail: (userContext, events, done) => {
    userContext.vars.$randomEmail = `load_${Math.floor(Math.random() * 1000) + 1}@test.com`;
    return done();
  },
};
