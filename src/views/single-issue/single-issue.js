import {Text, View, Image, TouchableOpacity, ScrollView, Clipboard, Platform, RefreshControl, Linking} from 'react-native';
import React, {PropTypes} from 'react';

import ApiHelper from '../../components/api/api__helper';
import {comment} from '../../components/icon/icon';
import KeyboardSpacer from 'react-native-keyboard-spacer';
import CustomFieldsPanel from '../../components/custom-fields-panel/custom-fields-panel';
import SingleIssueComments from './single-issue__comments';
import SingleIssueTopPanel from './single-issue__top-panel';
import Router from '../../components/router/router';
import Header from '../../components/header/header';
import LinkedIssues from '../../components/linked-issues/linked-issues';
import {showActions} from '../../components/action-sheet/action-sheet';
import Wiki, {decorateRawText} from '../../components/wiki/wiki';
import IssuePermissions from '../../components/issue-permissions/issue-permissions';
import {notifyError, notify} from '../../components/notification/notification';
import SingleIssueCommentInput from './single-issue__comment-input';
import {COLOR_PINK} from '../../components/variables/variables';
import usage from '../../components/usage/usage';
import attachFile from '../../components/attach-file/attach-file';
import IssueSummary from '../../components/issue-summary/issue-summary';
import log from '../../components/log/log';
import styles from './single-issue.styles';
import AttachmentsRow from '../../components/attachments-row/attachments-row';

const CATEGORY_NAME = 'Issue';

export default class SingeIssueView extends React.Component {
  static contextTypes = {
    actionSheet: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.issuePermissions = new IssuePermissions(this.props.api.auth.permissions, this.props.api.auth.currentUser);

    this.state = {
      issue: null,
      isRefreshing: false,
      fullyLoaded: false,

      editMode: false,
      isSavingEditedIssue: false,
      attachingImage: null,
      addCommentMode: false,
      commentText: '',
      summaryCopy: null,
      descriptionCopy: null
    };

    usage.trackScreenView(CATEGORY_NAME);
  }

  componentDidMount() {
    this.setState({issue: this.props.issuePlaceholder});
    this.loadIssue(this.props.issueId);
  }

  componentWillUnmount() {
    this.isUnmounted = true;
  }

  loadIssue(id) {

    const getIssue = (issueId) => {
      if (/[A-Z]/.test(issueId)) {
        return this.props.api.hackishGetIssueByIssueReadableId(issueId);
      }
      return this.props.api.getIssue(issueId);
    };

    return getIssue(id)
      .then((issue) => {
        issue.fieldHash = ApiHelper.makeFieldHash(issue);
        return issue;
      })
      .then((issue) => {
        log.log('Issue loaded', issue);
        if (this.isUnmounted) {
          return;
        }
        this.setState({issue, fullyLoaded: true});
        return issue;
      })
      .catch((err) => notifyError('Failed to load issue', err));
  }

  async addComment(issue, comment) {
    try {
      const createdComment = await this.props.api.addComment(issue.id, comment);

      log.info('Comment created', createdComment);
      usage.trackEvent(CATEGORY_NAME, 'Add comment', 'Success');

      this.setState({
        addCommentMode: false,
        commentText: '',
        issue: {
          ...this.state.issue,
          comments: [
            ...this.state.issue.comments,
            createdComment
          ]
        }
      });
      return await this.loadIssue(this.state.issue.id);
    } catch (err) {
      notifyError('Cannot post comment', err);
    }
  }

  async attachPhoto(takeFromLibrary = true) {
    try {
      const attachingImage = await attachFile();

      this.setState({
        issue: {
          ...this.state.issue,
          attachments: [attachingImage].concat(this.state.issue.attachments)
        },
        attachingImage
      });

      try {
        await this.props.api.attachFile(this.state.issue.id, attachingImage.url, attachingImage.name);
        usage.trackEvent(CATEGORY_NAME, 'Attach image', 'Success');
      } catch (err) {
        notifyError('Cannot attach file', err);
        this.setState({
          issue: {
            ...this.state.issue,
            attachments: this.state.issue.attachments.filter(attach => attach !== attachingImage)
          }
        });
      }
      this.setState({attachingImage: null});
    } catch (err) {
      notifyError('ImagePicker error', err);
    }
  }

  onIssueFieldValueUpdate = async (field, value) => {
    usage.trackEvent(CATEGORY_NAME, 'Update field value');

    const {issue} = this.state;
    const newFields = issue.fields.map(it => it === field ? {...it, value} : it);
    this.setState({issue: {...issue, fields: newFields}});

    const updateMethod = field.hasStateMachine ?
      this.props.api.updateIssueFieldEvent.bind(this.props.api) :
      this.props.api.updateIssueFieldValue.bind(this.props.api);

    try {
      await updateMethod(issue.id, field.id, value);
      const updatedIssue = await this.loadIssue(issue.id);
      this.props.onUpdate(updatedIssue);
    } catch (err) {
      notifyError('Failed to update issue field', err);
      this.loadIssue(issue.id);
    }
  }

  onUpdateProject = async project => {
    usage.trackEvent(CATEGORY_NAME, 'Update project');

    const {issue} = this.state;
    this.setState({issue: {...issue, project}});

    try {
      await this.props.api.updateProject(issue, project);
      const updatedIssue = await this.loadIssue(issue.id);
      this.props.onUpdate(updatedIssue);
    } catch (err) {
      notifyError('Failed to update issue project', err);
      this.loadIssue(issue.id);
    }
  }

  onSaveChanges = async () => {
    const {issue, summaryCopy, descriptionCopy} = this.state;
    const editedIssue = {...issue, summary: summaryCopy, description: descriptionCopy};
    this.setState({issue: editedIssue, isSavingEditedIssue: true});

    try {
      await this.props.api.updateIssueSummaryDescription(editedIssue);
      usage.trackEvent(CATEGORY_NAME, 'Update issue', 'Success');

      const updatedIssue = await this.loadIssue(issue.id);
      this.props.onUpdate(updatedIssue);
    } catch (err) {
      notifyError('Failed to update issue', err);
      this.loadIssue(issue.id);
    } finally {
      this.setState({editMode: false, isSavingEditedIssue: false});
    }
  }

  goToIssue(issue) {
    issue.fieldHash = ApiHelper.makeFieldHash(issue);

    Router.SingleIssue({
      issuePlaceholder: issue,
      issueId: issue.id,
      api: this.props.api
    });
  }

  goToIssueById(issueId) {
    Router.SingleIssue({
      issueId: issueId,
      api: this.props.api
    });
  }

  openIssueListWithSearch(query) {
    Router.IssueList({auth: this.props.api.auth, query: query});
  }

  _makeIssueWebUrl(issue, commentId) {
    const {numberInProject, project} = this.state.issue;
    const commentHash = commentId ? `#comment=${commentId}` : '';
    return `${this.props.api.config.backendUrl}/issue/${project.shortName}-${numberInProject}${commentHash}`;
  }

  _showActions() {
    const editAction = this.issuePermissions.canUpdateGeneralInfo(this.state.issue) ? {
      title: 'Edit issue',
      execute: () => {
        usage.trackEvent(CATEGORY_NAME, 'Start issue editing');
        this.setState({
          editMode: true,
          summaryCopy: this.state.issue.summary,
          descriptionCopy: this.state.issue.description
        });
      }
    } : null;

    const addAttachmentAction = this.issuePermissions.canAddAttachmentTo(this.state.issue) ? {
      title: 'Attach image...',
      execute: this.attachPhoto.bind(this)
    } : null;

    const actions = [
      editAction,
      {
        title: 'Copy issue URL',
        execute: () => {
          usage.trackEvent(CATEGORY_NAME, 'Copy isue URL');
          Clipboard.setString(this._makeIssueWebUrl(this.state.issue));
          notify('Issue URL has been copied');
        }
      },
      {
        title: 'Open issue in browser',
        execute: () => {
          usage.trackEvent(CATEGORY_NAME, 'Open in browser');
          Linking.openURL(this._makeIssueWebUrl(this.state.issue));
        }
      },
      addAttachmentAction,
      {title: 'Cancel'}
    ]
      .filter(item => item !== null);

    return showActions(actions, this.context.actionSheet())
      .then(action => action.execute())
      .catch(err => {});
  }

  copyCommentUrl(comment) {
    Clipboard.setString(this._makeIssueWebUrl(this.state.issue, comment.id));
    notify('Comment URL has been copied');
  }

  loadCommentSuggestions(query) {
    return this.props.api.getMentionSuggests([this.state.issue.id], query)
      .catch(err => notifyError('Cannot load suggestions', err));
  }

  _canAddComment() {
    return this.state.fullyLoaded &&
      !this.state.addCommentMode &&
      this.issuePermissions.canCommentOn(this.state.issue);
  }

  _renderHeader() {
    const title = <Text style={styles.headerText} selectable={true}>
      {this.state.issue ? `${this.state.issue.project.shortName}-${this.state.issue.numberInProject}` : `Loading...`}
    </Text>;

    if (!this.state.editMode) {
      const actionsAvailable = this.state.issue;

      return <Header leftButton={<Text>Back</Text>}
                     rightButton={<Text style={actionsAvailable ? null : styles.disabledSaveButton}>Actions</Text>}
                     onRightButtonClick={() => actionsAvailable && this._showActions()}>
        {title}
      </Header>;

    } else {
      const canSave = Boolean(this.state.summaryCopy) && !this.state.isSavingEditedIssue;
      const saveButton = <Text style={canSave ? null : styles.disabledSaveButton}>Save</Text>;

      return <Header leftButton={<Text>Cancel</Text>}
                     onBack={() => this.setState({editMode: false})}
                     rightButton={saveButton}
                     onRightButtonClick={() => canSave && this.onSaveChanges()}>
        {title}
      </Header>;

    }
  }

  _renderIssueView(issue) {
    return (
      <View style={styles.issueViewContainer}>
        <SingleIssueTopPanel issue={issue} onTagPress={query => this.openIssueListWithSearch(query)}/>

        {this.state.editMode && <IssueSummary
              editable={!this.state.isSavingEditedIssue}
              summary={this.state.summaryCopy}
              description={this.state.descriptionCopy}
              onSummaryChange={summaryCopy => this.setState({summaryCopy})}
              onDescriptionChange={descriptionCopy => this.setState({descriptionCopy})}
        />}

        {!this.state.editMode && <View>
          <Text style={styles.summary}  selectable={true}>{issue.summary}</Text>

          {issue.links && <LinkedIssues links={issue.links} onIssueTap={issue => this.goToIssue(issue)}/>}

          {issue.description ? <Wiki
            style={styles.description}
            attachments={issue.attachments}
            onIssueIdTap={issueId => this.goToIssueById(issueId)}
          >
            {decorateRawText(issue.description, issue.wikifiedDescription, issue.attachments)}
          </Wiki> : null}
        </View>}

        {issue.attachments ? <AttachmentsRow
          attachments={issue.attachments}
          attachingImage={this.state.attachingImage}
          onOpenAttachment={(type, name) => usage.trackEvent(CATEGORY_NAME, type === 'image' ? 'Showing image' : 'Open attachment by URL')}
        /> : null}
      </View>
    );
  }

  _renderRefreshControl() {
    return <RefreshControl
      refreshing={this.state.isRefreshing}
      tintColor={COLOR_PINK}
      onRefresh={() => {
        this.setState({isRefreshing: true});
        this.loadIssue(this.state.issue.id)
          .then(() => this.setState({isRefreshing: false}))
          .catch(() => this.setState({isRefreshing: false}));
      }}
    />;
  }

  render() {
    return (
      <View style={styles.container}>
        {this._renderHeader()}

        {this.state.issue && <ScrollView refreshControl={this._renderRefreshControl()}
                                         keyboardDismissMode="interactive"
                                         keyboardShouldPersistTaps="handled">
          {this._renderIssueView(this.state.issue)}

          {!this.state.fullyLoaded && <View><Text style={styles.loading}>Loading...</Text></View>}

          {this.state.fullyLoaded && <View style={styles.commentsListContainer}>
            <SingleIssueComments
              comments={this.state.issue.comments}
              attachments={this.state.issue.attachments}
              api={this.props.api}
              onReply={(comment) => {
                this.setState({
                  addCommentMode: true,
                  commentText: `@${comment.author.login} `
                });
              }}
              onCopyCommentLink={(comment) => this.copyCommentUrl(comment)}
              onIssueIdTap={issueId => this.goToIssueById(issueId)}/>
          </View>}

          {Platform.OS == 'ios' && <KeyboardSpacer/>}
        </ScrollView>}

        {this.state.addCommentMode && <View>
          <SingleIssueCommentInput
            autoFocus={true}
            suggestionsDataSource={query => this.loadCommentSuggestions(query)}
            onBlur={() => this.setState({addCommentMode: false})}
            initialText={this.state.commentText}
            onChangeText={text => this.setState({commentText: text})}
            onAddComment={(comment) => this.addComment(this.state.issue, comment)}
          />

          {Platform.OS == 'ios' && <KeyboardSpacer style={{backgroundColor: 'black'}}/>}
        </View>}

        {this._canAddComment() && <View style={styles.addCommentContainer}>
          <TouchableOpacity
            style={styles.addCommentButton}
            onPress={() => this.setState({addCommentMode: true, initialText: this.state.commentText})}>
            <Image source={comment} style={styles.addCommentIcon}/>
          </TouchableOpacity>
        </View>}


        {this.state.issue && !this.state.addCommentMode && <CustomFieldsPanel
          api={this.props.api}
          canEditProject={this.issuePermissions.canUpdateGeneralInfo(this.state.issue)}
          issue={this.state.issue}
          issuePermissions={this.issuePermissions}
          onUpdate={this.onIssueFieldValueUpdate}
          onUpdateProject={this.onUpdateProject}/>}
      </View>
    );
  }
}
