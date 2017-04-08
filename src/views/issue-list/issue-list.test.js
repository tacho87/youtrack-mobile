import * as actions from './issue-list-actions';
import * as types from './issue-list-action-types';
import sinon from 'sinon';
import {AsyncStorage as MockedStorage} from 'react-native';
import reducer from './issue-list-reducers';

describe('Issue list actions', () => {
  let dispatch;
  let getState;
  let sandbox;
  const TEST_QUERY = 'test-query';

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    const state = {
      app: {
        auth: {
          currentUser: {id: 'current-user'}
        }
      }
    };
    dispatch = sinon.spy();
    getState = () => state;
  });

  afterEach(() => sandbox.restore());

  it('should set issues query', () => {
    actions
      .setIssuesQuery(TEST_QUERY)
      .should.deep.equal({type: types.SET_ISSUES_QUERY, query: TEST_QUERY});
  });

  it('should read stored query', async () => {
    sandbox.stub(MockedStorage, 'getItem', () => new Promise(resolve => resolve(TEST_QUERY)));
    await actions.readStoredIssuesQuery()(dispatch);

    dispatch.should.have.been.calledWith({type: types.SET_ISSUES_QUERY, query: TEST_QUERY});
  });

  it('should load query assist suggestions if query is not empty', async () => {
    const suggestions = [{id: 'test'}];
    const apiMock = {
      getQueryAssistSuggestions: () => new Promise(resolve => resolve(suggestions))
    };
    await actions.suggestIssuesQuery(TEST_QUERY, 4)(dispatch, getState, () => apiMock);

    dispatch.should.have.been.calledWith({type: types.SUGGEST_QUERY, suggestions});
  });

  it('should load saved query and last searches if query is empty', async () => {
    const savedQueries = [
      {id: 'saved', owner: {ringId: 'current-user'}},
      {id: 'saved-not-own', owner: {ringId: 'other-user'}}
    ];
    sinon.stub(MockedStorage,
      'getItem',
      () => new Promise(resolve => resolve(JSON.stringify(['last-query'])))
    );

    const apiMock = {
      getSavedQueries: () => new Promise(resolve => resolve(savedQueries))
    };

    await actions.suggestIssuesQuery('', 0)(dispatch, getState, () => apiMock);

    dispatch.should.have.been.calledWith({
      type: types.SUGGEST_QUERY,
      suggestions: [savedQueries[0], {name: 'last-query', query: 'last-query'}]
    });
  });

  it('should clear query assist suggestions', () => {
    actions
      .clearAssistSuggestions()
      .should.deep.equal({type: types.CLEAR_SUGGESTIONS});
  });

});

describe('Issue list reducers', () => {
  it('should set issues query', () => {
    const newState = reducer({}, {type: types.SET_ISSUES_QUERY, query: 'test'});
    newState.should.deep.equal({query: 'test'});
  });

  it('should set query assist suggestions', () => {
    const suggestions = [{id: 'test'}];
    const newState = reducer({}, {type: types.SUGGEST_QUERY, suggestions});
    newState.should.deep.equal({queryAssistSuggestions: suggestions});
  });

  it('should start issue loading', () => {
    const newState = reducer({}, {type: types.START_ISSUES_LOADING});
    newState.should.deep.equal({
      loadingError: null,
      isListEndReached: false,
      isRefreshing: true,
      skip: 0
    });
  });

  it('should stop issues loading', () => {
    reducer({}, {type: types.STOP_ISSUES_LOADING})
      .should.deep.equal({isRefreshing: false});
  });

  it('should start loading more issues', () => {
    reducer({}, {type: types.START_LOADING_MORE, newSkip: 10})
      .should.deep.equal({isLoadingMore: true, skip: 10});
  });

  it('should stop loading more', () => {
    reducer({}, {type: types.STOP_LOADING_MORE})
      .should.deep.equal({isLoadingMore: false});
  });

  it('should receive issues', () => {
    const issues = [{id: 'test'}];
    reducer({}, {type: types.RECEIVE_ISSUES, issues})
      .should.deep.equal({issues, isInitialized: true});
  });

  it('should set error on failed to load issues', () => {
    const error = new Error();
    reducer({}, {type: types.LOADING_ISSUES_ERROR, error})
      .should.deep.equal({
        isInitialized: true,
        isListEndReached: true,
        loadingError: error,
        issues: []
      });
  });

  it('should set that issues list end is reached', () => {
    reducer({}, {type: types.LIST_END_REACHED})
      .should.deep.equal({isListEndReached: true});
  });

  it('should find and update issue in list and not take rest props from updated issue', () => {
    const state = {
      issues: [
        {id: 'test', summary: 'before update'},
        {id: 'another-issue', summary: 'another'}
      ]
    };
    const updatedIssue = {id: 'test', summary: 'after update', foo: 'bar'};
    const newState = reducer(state, {
      type: types.UPDATE_ISSUE_ON_LIST,
      issue: updatedIssue
    });

    newState.issues.should.deep.equal([
      {id: 'test', summary: 'after update'},
      {id: 'another-issue', summary: 'another'}
    ]);
  });

});
