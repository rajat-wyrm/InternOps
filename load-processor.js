module.exports = {
  generateRandomEmail: (userContext, events, done) => {
    userContext.vars.$randomEmail = `load_${Math.floor(Math.random() * 10000)}@test.com`;
    return done();
  },
};
