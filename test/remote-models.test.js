// Copyright IBM Corp. 2016. All Rights Reserved.
// Node module: loopback-connector-remote
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var assert = require('assert');
var helper = require('./helper');
var TaskEmitter = require('strong-task-emitter');

describe('Remote model tests', function() {
  var ctx = this;

  beforeEach(function(done) {
    ctx.serverApp = helper.createRestAppAndListen();

    var memoryDs = helper.createMemoryDataSource();
    ctx.ServerModel = helper.createModel({
      name: 'TestModel',
      app: ctx.serverApp,
      datasource: memoryDs,
      properties: helper.getUserProperties()
    });

    ctx.ServerRelatedModel = helper.createModel({
      name: 'RelatedModel',
      app: ctx.serverApp,
      datasource: memoryDs,
      properties: { name: 'String' },
      options: {
        relations: {
          related: { type: 'hasMany', model: ctx.ServerModel }
        }
      }
    });

    ctx.serverApp.locals.handler.on('listening', done);
  });

  beforeEach(function setupRemoteClient(done) {
    ctx.remoteApp = helper.createRestAppAndListen();
    var remoteDs = helper.createRemoteDataSource(ctx.serverApp);

    ctx.RemoteModel = helper.createModel({
      name: 'TestModel',
      app: ctx.remoteApp,
      datasource: remoteDs,
      properties: helper.getUserProperties()
    });

    ctx.RemoteRelatedModel = helper.createModel({
      name: 'RelatedModel',
      app: ctx.remoteApp,
      datasource: remoteDs,
      properties: { name: 'String' },
      options: {
        relations: {
          related: { type: 'hasMany', model: ctx.RemoteModel }
        }
      }
    });

    ctx.remoteApp.locals.handler.on('listening', done);
  });

  afterEach(function() {
    ctx.serverApp.locals.handler.close();
    ctx.remoteApp.locals.handler.close();
    ctx.ServerModel = null;
    ctx.ServerRelatedModel = null;
    ctx.RemoteModel = null;
    ctx.RemoteRelatedModel = null;
  });

  describe('Model.create([data], [callback])', function() {
    it('should create an instance and save to the attached data source',
        function(done) {
      ctx.RemoteModel.create({first: 'Joe', last: 'Bob'}, function(err, user) {
        assert(user instanceof ctx.RemoteModel);
        done();
      });
    });
  });

  describe('model.save([options], [callback])', function() {
    it('should save an instance of a Model to the attached data source',
        function(done) {
      var joe = new ctx.RemoteModel({first: 'Joe', last: 'Bob'});
      joe.save(function(err, user) {
        assert(user.id);
        assert(!err);
        assert(!user.errors);
        done();
      });
    });
  });

  describe('model.updateAttributes(data, [callback])', function() {
    it('should save specified attributes to the attached data source',
        function(done) {
      ctx.ServerModel.create({first: 'joe', age: 100}, function(err, user) {
        assert(!err);
        assert.equal(user.first, 'joe');

        user.updateAttributes({
          first: 'updatedFirst',
          last: 'updatedLast'
        }, function(err, updatedUser) {
          assert(!err);
          assert.equal(updatedUser.first, 'updatedFirst');
          assert.equal(updatedUser.last, 'updatedLast');
          assert.equal(updatedUser.age, 100);
          done();
        });
      });
    });
  });

  describe('Model.upsert(data, callback)', function() {
    it('should update when a record with id=data.id is found, insert otherwise',
        function(done) {
      ctx.RemoteModel.upsert({first: 'joe', id: 7}, function(err, user) {
        assert(!err);
        assert.equal(user.first, 'joe');

        ctx.RemoteModel.upsert({first: 'bob', id: 7}, function(err,
            updatedUser) {
          assert(!err);
          assert.equal(updatedUser.first, 'bob');
          done();
        });
      });
    });
  });

  describe('Model.deleteById(id, [callback])', function() {
    it('should delete a model instance from the attached data source',
        function(done) {
      ctx.ServerModel.create({first: 'joe', last: 'bob'}, function(err, user) {
        ctx.RemoteModel.deleteById(user.id, function(err) {
          ctx.RemoteModel.findById(user.id, function(err, notFound) {
            assert.equal(notFound, null);
            done();
          });
        });
      });
    });
  });

  describe('Model.findById(id, callback)', function() {
    it('should find an instance by id from the attached data source',
        function(done) {
      ctx.ServerModel.create({first: 'michael', last: 'jordan', id: 23},
          function() {
        ctx.RemoteModel.findById(23, function(err, user) {
          assert.equal(user.id, 23);
          assert.equal(user.first, 'michael');
          assert.equal(user.last, 'jordan');
          done();
        });
      });
    });

    it('should support the include filter', function (done) {
      ctx.ServerRelatedModel.create({}, function (err, relatedInstance) {
        if (err) return done(err);
        relatedInstance.related.create({ name: 'INCLUDE-TEST' }, function (err, modelInstance) {
          if (err) return done(err);
          ctx.RemoteRelatedModel.findById(relatedInstance.id, { include: 'related' }, function (err, remoteInstance) {

            if (err) return done(err);
            assert(remoteInstance instanceof ctx.RemoteRelatedModel);
            assert.equal(remoteInstance.id, relatedInstance.id);

            var related = remoteInstance.related();
            assert(Array.isArray(related), 'Expected array of related models, got: '+related);
            assert.equal(related[0].id, modelInstance.id);
            assert.equal(related[0].name, 'INCLUDE-TEST');

            done();
          });
        });
      });
    });

  });

  describe('Model.count([query], callback)', function() {
    it('should return the count of Model instances from both data source',
        function(done) {
      var taskEmitter = new TaskEmitter();
      taskEmitter
        .task(ctx.ServerModel, 'create', {first: 'jill', age: 100})
        .task(ctx.RemoteModel, 'create', {first: 'bob', age: 200})
        .task(ctx.RemoteModel, 'create', {first: 'jan'})
        .task(ctx.ServerModel, 'create', {first: 'sam'})
        .task(ctx.ServerModel, 'create', {first: 'suzy'})
        .on('done', function() {
          ctx.RemoteModel.count({age: {gt: 99}}, function(err, count) {
            assert.equal(count, 2);
            done();
          });
        });
    });
  });
});
