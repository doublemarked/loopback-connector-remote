/*!
 * Dependencies
 */
var relation = require('loopback-datasource-juggler/lib/relation-definition');
var RelationDefinition = relation.RelationDefinition;

module.exports = RemoteRelationMixin;

/**
 * RemoteRelationMixin class. Wraps all vivified relations to ensure they are
 * proxied through the remote connector.
 *
 * @class RemoteRelationMixin
 */
function RemoteRelationMixin() {
}

Object.keys(RelationDefinition).forEach(function (relation) {
  RemoteRelationMixin[relation] = function (modelTo, params) {
    var def = RelationDefinition[relation](this, modelTo, params);
    // Ensure any resulting methods are proxied by the remote connector
    this.dataSource.adapter.resolve(this);
    return def;
  };
});
