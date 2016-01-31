'use strict';

const path = require('path');
const request = require('supertest-as-promised');
const chai = require('chai');
const expect = chai.expect;
// const tbd = require('chai-tbd');

chai.use(require('dirty-chai'));
chai.use(require('sinon-chai'));
require('mocha-sinon');

const SIMPLE_APP = path.join(__dirname, 'fixtures', 'simple-app');
const app = require(path.join(SIMPLE_APP, 'server/server.js'));

function json(verb, url, data) {
  return request(app)[verb](url)
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .send(data)
    .expect('Content-Type', /json/);
}

describe('User Context Middleware', function() {
  describe('Without loopback context', function() {
    it('should return null', function() {
      const currentUser = app.models.Thing.getCurrentUser();

      expect(currentUser).to.be.null();
    });
  });

  describe('With user in loopback context', function() {
    it('should return the user', function() {
      app.loopback.runInContext(function() {
        const loopbackContext = app.loopback.getCurrentContext();
        const user = {
          id: 'generalUser',
          username: 'generalUser',
          password: '$2a$10$Hb5a4OK7ZK97zdziGLSYgOScOy2lRQi0Kd2RCkldxRk0hZo6Eemy6',
          email: 'generalUser@fullcube.com'
        };

        loopbackContext.set('currentUser', user);
        expect(app.models.Thing.getCurrentUser()).to.equal(user);
      });
    });
  });

  describe('Called remotely', function() {
    describe('Role: unauthenticated', function() {
      it('should return null', function() {
        return json('get', '/api/users/currentUser')
          .expect(200)
          .then(res => {
            expect(res.body).to.be.null();
          });
      });
    });

    describe('Role: authenticated', function() {
      it('should return the current user', function() {
        return json('post', '/api/users/login')
          .send({ username: 'generalUser', password: 'password' })
          .expect(200)
          .then(res => json('get', `/api/users/currentUser?access_token=${res.body.id}`)
            .expect(200))
          .then(res => {
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('id', 'generalUser');
            expect(res.body).to.have.property('username', 'generalUser');
            expect(res.body).to.have.property('email', 'generalUser@fullcube.com');
          });
      });
    });
  });
});

describe('REST API', function() {
  describe('Role: unauthenticated', function() {
    it('should not allow access to list things without access token', function() {
      return json('get', '/api/things')
        .expect(401);
    });

    it('should not allow access to a teams thing without access token', function() {
      return json('get', '/api/things/1')
        .expect(401);
    });
  });

  describe('Role: athenticated', function() {
    it('should not allow access to a teams thing', function() {
      return json('post', '/api/users/login')
        .send({ username: 'generalUser', password: 'password' })
        .expect(200)
        .then(res => json('get', `/api/things/1?access_token=${res.body.id}`)
          .expect(401));
    });
  });

  describe('Role: team member', function() {
    it('should not allow getting another teams thing', function() {
      return json('post', '/api/users/login')
        .send({ username: 'programMemberA', password: 'password' })
        .expect(200)
        .then(res => json('get', `/api/things/2?access_token=${res.body.id}`)
          .expect(401));
    });

    it('should create a teams thing', function() {
      return json('post', '/api/users/login')
        .send({ username: 'programMemberA', password: 'password' })
        .expect(200)
        .then(res => json('post', `/api/things?access_token=${res.body.id}`, {
          programId: 'A',
          name: 'A thing'
        })
          .expect(200))
        .then(res => {
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('name', 'A thing');
        });
    });

    it('should read a teams thing', function() {
      return json('post', '/api/users/login')
        .send({ username: 'programMemberA', password: 'password' })
        .expect(200)
        .then(res => json('get', `/api/things/1?access_token=${res.body.id}`)
          .expect(200))
        .then(res => {
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('name', 'Widget 1');
        });
    });

    it('should update a teams thing', function() {
      return json('post', '/api/users/login')
        .send({ username: 'programMemberA', password: 'password' })
        .expect(200)
        .then(res => json('put', `/api/things/1?access_token=${res.body.id}`)
          .expect(200))
        .then(res => {
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('name', 'Widget 1');
        });
    });

    it('should not delete a teams thing', function() {
      return json('post', '/api/users/login')
        .send({ username: 'programMemberA', password: 'password' })
        .expect(200)
        .then(res => json('delete', `/api/things/1?access_token=${res.body.id}`)
          .expect(401));
    });
  });

  describe('Role: team admin', function() {
    it('should not allow getting another teams thing', function() {
      return json('post', '/api/users/login')
        .send({ username: 'programAdminA', password: 'password' })
        .expect(200)
        .then(res => json('get', `/api/things/2?access_token=${res.body.id}`)
          .expect(401));
    });

    it('should create a teams thing', function() {
      return json('post', '/api/users/login')
        .send({ username: 'programAdminA', password: 'password' })
        .expect(200)
        .then(res => json('post', `/api/things?access_token=${res.body.id}`, {
          programId: 'A',
          name: 'A thing'
        })
          .expect(200))
        .then(res => {
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('name', 'A thing');
        });
    });

    it('should read a teams thing', function() {
      return json('post', '/api/users/login')
        .send({ username: 'programAdminA', password: 'password' })
        .expect(200)
        .then(res => json('get', `/api/things/1?access_token=${res.body.id}`)
          .expect(200))
        .then(res => {
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('name', 'Widget 1');
        });
    });

    it('should update a teams thing', function() {
      return json('post', '/api/users/login')
        .send({ username: 'programAdminA', password: 'password' })
        .expect(200)
        .then(res => json('put', `/api/things/1?access_token=${res.body.id}`)
          .expect(200))
        .then(res => {
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('name', 'Widget 1');
        });
    });

    it('should delete a teams thing', function() {
      return json('post', '/api/users/login')
        .send({ username: 'programAdminA', password: 'password' })
        .expect(200)
        .then(res => json('delete', `/api/things/1?access_token=${res.body.id}`)
          .expect(200));
    });
  });
});
