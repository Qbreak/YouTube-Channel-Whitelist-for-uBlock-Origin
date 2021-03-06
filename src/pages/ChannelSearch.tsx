import * as React from "react";
import { Component, Fragment } from "react";

import Modal from "reactstrap/src/Modal";
import ModalHeader from "reactstrap/src/ModalHeader";
import ModalBody from "reactstrap/src/ModalBody";

import { Channel as _Channel, ChannelList } from "../typings";
interface ChannelSearchState {
    whitelist: ChannelList;
    channels: Array<any>
    text: string;
    show: boolean;
    searching: number;
    permission: boolean;
}
interface ChannelSearchProps {
    dismiss: () => void;
    onSelected: (channel: _Channel) => Promise<void>;
    whitelist: ChannelList;
    full: boolean;
    show: boolean;
}
class ChannelSearch extends Component<ChannelSearchProps, ChannelSearchState> {
    selectChannel: ChannelSearchProps["onSelected"];
    full: boolean;
    dismiss: () => void;
    isFirefoxOrEdge: boolean;
    searchTimeout: number;
    searchInput?: HTMLInputElement;
    response?: any;

    constructor(props: ChannelSearchProps) {
        super(props);
        this.selectChannel = props.onSelected;
        this.full = props.full;
        this.dismiss = props.dismiss;
        this.state = {
            whitelist: props.whitelist,
            channels: [],
            text: "",
            show: props.show,
            searching: 0,
            permission: false
        }
        this.isFirefoxOrEdge = !!(browser.runtime.getBrowserInfo || window.navigator.platform.indexOf("Edge/") !== -1);
        this.searchTimeout = null;
        this.inputChanged = this.inputChanged.bind(this);
        this.channelSelected = this.channelSelected.bind(this);
        this.requestPermissions = this.requestPermissions.bind(this);
        this.openSettings = this.openSettings.bind(this)
        this.focusSearch = this.focusSearch.bind(this);
    }

    componentDidMount() {
        browser.permissions.contains({ origins: ["*://*.content.googleapis.com/"] }).then(granted => {
            this.setState({ permission: granted });
        })
    }

    componentWillReceiveProps(nextProps: ChannelSearchProps) {
        let nextState = {} as any;

        nextState.show = nextProps.show;
        nextState.whitelist = nextProps.whitelist;

        if (nextState.show) {

        } else {
            nextState.channels = [];
            nextState.text = "";
        }

        this.setState(nextState);
    }

    requestPermissions() {
        browser.permissions.request({ origins: ["*://*.content.googleapis.com/"] }).then(granted => {
            if (granted) {
                browser.runtime.sendMessage({ action: "permission", type: "google-api" } as any).then((response: any) => { })
            }
            this.setState({ permission: granted }, this.focusSearch)
        }).catch(err => console.error(err));
    }

    openSettings() {
        browser.tabs.create({
            active: true,
            url: 'settings.html#searchpermissions'
        });
        window.close();
    }

    inputChanged(event: React.FormEvent<HTMLInputElement>) {
        let nextState = {} as ChannelSearchState;
        if (event.currentTarget.id === "search") {
            nextState.text = event.currentTarget.value;
            nextState.searching = 1;

            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }

            this.searchTimeout = window.setTimeout(() => {
                fetch("https://content.googleapis.com/youtube/v3/search?type=channel&q=" + nextState.text + "&maxResults=10&part=snippet&key=AIzaSyCPqJiD5cXWMilMdzmu4cvm8MjJuJsbYIo")
                    .then(resp => resp.json())
                    .then(json => this.response = json)
                    .then(json => this.setState({ channels: json.items, searching: 0 }))
                    .catch(err => this.setState({ searching: 2 }))
            }, 500);
        }

        this.setState(nextState);
    }
    channelSelected(channel: _Channel) {
        this.selectChannel(channel)
            .then(() => this.searchInput.select());
    }
    focusSearch() {
        if (this.searchInput)
            this.searchInput.focus();
    }

    render() {
        let channelSearch;
        let searchIcon;

        if (this.state.searching === 0) {
            searchIcon = "fa-search";
        } else if (this.state.searching === 1) {
            searchIcon = "fa-spinner fa-spin";
        } else if (this.state.searching === 2) {
            searchIcon = "fa-exclamation-circle";
        }

        let search = this.state.permission && <Fragment>
            <input
                ref={searchInput => this.searchInput = searchInput}
                type="text"
                id="search"
                onChange={this.inputChanged}
                value={this.state.text}
                placeholder="Channel name.."
                className={"form-control " + (this.full ? "form-control-sm" : "form-control-sm")} />
            <i className={"fas modal-search-feedback " + searchIcon} />
        </Fragment>;

        let items;
        if (this.state.channels.length) {
            items = this.state.channels.map(item => <Channel
                full={this.full}
                item={item}
                onClick={this.channelSelected}
                key={item.etag}
                added={this.state.whitelist.findIndex(witem => witem.id === item.id.channelId) !== -1} />);
        } else {
            if (this.state.permission) {
                if (this.state.searching === 2) {
                    items = <span className="bold">Could not load results. Offline?</span>
                } else {
                    items = <span className="text-muted bold">Type to search for a YouTube channel</span>
                }
            } else {

                items = <Fragment>
                    <h5>One-time permission needed to access public YouTube channel listings: </h5>
                    {!this.full && this.isFirefoxOrEdge ?
                        <button className="btn btn-lg btn-primary" onClick={this.openSettings}>
                            Open options
                        </button>
                        :
                        <button className="btn btn-lg btn-primary" onClick={this.requestPermissions}>
                            Grant
                        </button>
                    }
                </Fragment>

            }
        }
        if (this.full) {
            channelSearch = <Modal isOpen={this.state.show} toggle={this.dismiss} centered={true} onOpened={this.focusSearch}>
                <ModalHeader toggle={this.dismiss} tag="div">
                    {search}
                </ModalHeader>
                <ModalBody>
                    <div className="list-group">
                        {items}
                    </div>
                </ModalBody>
            </Modal>
        } else {
            channelSearch = <div className="channel-search">
                <div className="channel-search-header">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={this.dismiss}>
                        <i className="fas fa-arrow-alt-circle-left" />
                    </button>
                    {search}
                </div>
                <div className="list-group channel-list">
                    {items}
                </div>
            </div>
        }

        return channelSearch;
    }
}
interface ChannelState {
    title: string;
    thumbnail: string;
    description: string;
    hovering: boolean;
    added: boolean;
    url: string;
}
interface ChannelProps {
    item: any;
    added: boolean;
    full: boolean;
    onClick: (channel: _Channel) => void;
}
class Channel extends Component<ChannelProps, ChannelState>{
    item: any;
    full: boolean;
    onClick: ChannelProps["onClick"];
    constructor(props: ChannelProps) {
        //gets data, renders html with profile picture, display name, link to channel, and add button;
        super(props);
        this.item = props.item;
        this.onClick = props.onClick;
        this.state = {
            title: props.item.snippet.channelTitle,
            thumbnail: props.item.snippet.thumbnails.default.url,
            description: props.item.snippet.description,
            hovering: false,
            added: props.added,
            url: this.getUrl(props.added)
        }

        this.click = this.click.bind(this);
    }

    componentWillReceiveProps(nextProps: ChannelProps) {
        if (this.item.etag !== nextProps.item.etag) {
            console.log("changed");
        }
        if (nextProps.added !== this.state.added) {
            this.setState({
                added: nextProps.added,
                url: this.getUrl(nextProps.added)
            });
        }
    }

    getUrl(added: boolean) {
        return "https://youtube.com/channel/" + this.item.id.channelId + (added ? "?igno=re&disableadblock=1" : "");
    }

    toggleHovering(hoveringState: boolean) {
        this.setState({ hovering: hoveringState });
    }

    click() {
        let channelId = {
            id: this.item.id.channelId,
            display: this.item.snippet.title,
            username: ""
        }
        this.onClick(channelId);
    }

    render() {
        return <div
            className={"channel list-group-item"}
            onMouseEnter={this.toggleHovering.bind(this, true)}
            onMouseLeave={this.toggleHovering.bind(this, false)}>

            <div className="channel-thumb-container" >
                <img className="channel-thumb" src={this.state.thumbnail} />
            </div>
            <div className="channel-info">
                <a className="channel-name bold link" href={this.state.url}>{this.state.title}</a>
                <span className={this.full ? "channel-desc" : "hidden"}>{this.state.description}</span>
            </div>
            <div className={"channel-action " + (this.state.hovering || (!this.state.hovering && this.state.added) ? "" : "invisible")}>
                <button
                    className={"btn btn-sm " + (this.state.added ? (!this.state.hovering ? "btn-link" : "btn-danger") : "btn-primary")}
                    disabled={this.state.added && !this.state.hovering}
                    onClick={this.click}>

                    {!this.state.added && <Fragment><i className="fas fa-plus" /><span> Add</span></Fragment>}
                    {this.state.added && !this.state.hovering && "Added"}
                    {this.state.added && this.state.hovering && <Fragment><i className="fas fas-minus" /><span> Remove</span> </Fragment>}
                </button>
            </div>
        </div>
    }
}

export { ChannelSearch }