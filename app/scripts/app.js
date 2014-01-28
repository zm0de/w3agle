/*global google,Parse,MarkerWithLabel,$*/
'use strict';

var app = angular.module('WeagleApp', []);

Parse.initialize('6qhUFEXtzdSTLwzG9VMeCU5oFaTWtgelh61unUiw', 'cTi3fECgna7cBjeYdyNIA6qnjehp1O8Ldrs8c5pe');
app.config(['$routeProvider', function($routeProvider){
  $routeProvider
  .when('/', {
    controller: 'LoginCtrl',
    templateUrl: 'views/login.html'
  })
  .when('/home', {
    controller: 'GetLocation',
    templateUrl: 'views/main.html'
  })
  .when('/message', {
    controller: 'MessagesCtrl',
    templateUrl: 'views/message.html'
  }).when('/checkins', {
    controller: 'CheckInCtrl',
    templateUrl: 'views/checkin.html'
  }).when('/checkin', {
    controller: 'EmployeCheckInCtrl',
    templateUrl: 'views/employe_checkin.html'
  }).when('/task', {
    controller: 'TaskCtrl',
    templateUrl: 'views/task.html'
  }).when('/logout', {
    controller: 'LogoutCtrl',
    templateUrl: 'views/login.html'
  }).otherwise({redirectTo: '/home'});

  // $locationProvider.html5Mode(true);
}]);

app.run(function($rootScope, $location, AuthenticationService, FlashService) {

  var routesThatRequireAuth = ['/home', '/message', '/checkins', '/task'];
  var routesThatRequireAuthUser = ['/logout'];

  $rootScope.$on('$routeChangeStart', function() {
    if (_(routesThatRequireAuth).contains($location.path()) && !AuthenticationService.isLoggedIn()) {
      $location.path('/');
      FlashService.show('Please log in to continue.');
    }
    $rootScope.navCurrent = $location.path();

    if(AuthenticationService.isLoggedIn() && $rootScope.Role === 'User' && !(_(routesThatRequireAuthUser).contains($location.path()))){
      $location.path('/checkin');
    }
  });
});

app.factory('FlashService', function($rootScope) {
  return {
    show: function(message) {
      $rootScope.flash = message;
    },
    clear: function() {
      $rootScope.flash = '';
    }
  };
});

app.factory('AuthenticationService', function($rootScope, $location, FlashService) {

  var loginError = function(msg) {
    FlashService.show(msg);
  };
  var setUser = function(name, email, role) {
    $rootScope.Username = name;
    $rootScope.Useremail = email;
    $rootScope.Role = role;
  };
  var unsetUser = function() {
    Parse.User.logOut();
    $rootScope.Username = '';
    $rootScope.Useremail = '';
  };
  var clearLoginLFlag= function(){
    $rootScope.loginLoadingFlag = false;

  };
  return{
    login: function(credentials) {
      $rootScope.loginLoadingFlag = true;
      Parse.User.logIn(credentials.username, credentials.password, {
        success: function(user) {
          setUser(user.get('name'), user.getEmail()), user.get('role');
          FlashService.clear();
          $location.path('/home');
          $rootScope.$apply();
          clearLoginLFlag();
        },
        error: function() {
          loginError('Username/Password incorrect');
          clearLoginLFlag();
          $rootScope.$apply();
        }
      });
    },
    logout: function() {
      unsetUser();
      loginError('Logged out successfully');
      $location.path('/');
    },
    isLoggedIn: function() {
      var currentUser = Parse.User.current();
      if (currentUser) {
        setUser(currentUser.get('name'), currentUser.getEmail(), currentUser.get('role'));
        return true;
      } else {
        return false;
      }
    },
  };
});

app.controller('LoginCtrl',['$scope', '$location', 'AuthenticationService', function($scope, $location, AuthenticationService) {
  $scope.credentials = {username: '', password: ''};
  if(AuthenticationService.isLoggedIn()){
    $location.path('/home');
  }
  $scope.login = function() {
    AuthenticationService.login($scope.credentials);

  };
}]);
app.controller('LogoutCtrl',['$scope','AuthenticationService', function($scope, AuthenticationService) {
  AuthenticationService.logout();
}]);

app.controller('GetLocation',['$scope', '$filter' , 'AuthenticationService', 'FlashService',  function($scope, $filter, AuthenticationService, FlashService){
  $scope.noDeviceFlag = false;
  var users = new Parse.Query('User');
  users.equalTo('parent', $scope.Useremail);
  users.find({
    success: function(results) {
      if(results.length === 0){
        $scope.$apply($scope.noDeviceFlag = true);
      }
      else{
        $scope.$apply(function() {
          $scope.Users = results.map(function(obj) {
            return {
              id: obj.get('email'),
              name: obj.get('name'),
              photo: obj.get('photo')
            };
          });
        });
      }
    },
    error: function(error) {
      $scope.noDeviceFlag = true;
      console.error('Parse Error: ' + error.code + ' ' + error.message);
    }
  });

  /*MAPS*/
  google.maps.visualRefresh = true;
  /* default location*/
  var latLng = new google.maps.LatLng(12, 75);
  var map = new google.maps.Map(document.getElementById('map_canvas'), {
    zoom: 7,
    center: latLng,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  });
  var markersArray = [];
  /* Function userd to delete all the markers from the map */
  function clearOverlays() {
    $scope.mainSelection = 'loading';
    for (var i = 0; i < markersArray.length; i++ ) {
      markersArray[i].setMap(null);
    }
    markersArray = [];
  }

  /*
   * [mapLocate to mark the point on the google maps]
   * @param  {[String]} email [description]
   * @param  {[String]} name  [description]
   * @param  {[boolean]} flag [to identify where the function is called from the showAll(), is that case the markers should be cleared ]
   * @param  {[String]} user  [user for Selection/active class]
   */

  $scope.mapLocate = function(email,name,flag) {
    $scope.mainSelection = 'loading';
    $scope.selected= email;
    google.maps.event.trigger(map, 'resize');
    var location = new Parse.Query('Checkin');
    location.equalTo('email', email);
    location.descending('createdAt');
    location.find({
      success: function(results) {
        FlashService.clear();
        if(results.length > 0 ){
          if(!flag){
            clearOverlays();
          }else{
            $scope.selected = 'showAll';
          }
          var result = results[0];
          latLng = new google.maps.LatLng(result.get('coordinates')['latitude'], result.get('coordinates')['longitude']);
          var marker = new MarkerWithLabel({
            position: latLng,
            map: map,
            labelContent: name,
            labelAnchor: new google.maps.Point(22, 0),
            labelClass: 'label label-success', // the CSS class for the label
            labelStyle: {opacity: 0.85},
          });
          markersArray.push(marker);
          map.panTo(latLng);
          $scope.mainSelection = 'maps';

        }else{
          if(!flag){
            clearOverlays();
            FlashService.show('No location information for this Device');
            $scope.mainSelection = 'maps';
          }
        }
        $scope.$apply();
      },
      error: function(error) {
        console.error('Parse Error: ' + error.code + ' ' + error.message);
      }
    });
  };

  $scope.showAll = function(){
    $scope.mainSelection = 'loading';
    clearOverlays();
    users = new Parse.Query('User');
    users.equalTo('parent', $scope.Useremail);
    users.find({
      success: function(results) {
        for(var i in results){
          $scope.mapLocate(results[i].getEmail(), results[i].get('name'),true);
        }
        $scope.mainSelection = 'maps';
      }
    });
  };
  $scope.checkIn = function(email){
    $scope.advanceSearchFlag = false;
    $scope.mainSelection = 'loading';
    $scope.selected= email;
    var checkins = new Parse.Query('Checkin');
    checkins.equalTo('email', email);
    checkins.descending('createdAt');
    checkins.find({
      success: function(results) {
        $scope.checkIns = results.map(function(obj) {
          return {
            location: obj.get('location'),
            message: obj.get('message'),
            time: obj.createdAt
          };
        });
        $scope.mainSelection = 'checkins';
        $scope.$apply();

      }
    });
  };
  $scope.searchCheckin = function(){
    angular.element('.chechinDatatable').dataTable( {
      'aoColumns': [
        null,
        null,
        { 'sType': 'datetime-us' }
      ],
      'aaSorting': [[ 2, 'desc' ]]
    } );
    $scope.advanceSearchFlag = true;
  };

  $scope.closeCheckins = function(){
    $scope.advanceSearchFlag = false;
    $scope.mainSelection = 'maps';
  };
  $scope.findMe = function() {
    navigator.geolocation.getCurrentPosition(function(position) {
      clearOverlays();
      latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      var marker = new MarkerWithLabel({
        position: latLng,
        map: map,
        labelContent: name,
        labelAnchor: new google.maps.Point(22, 0),
        labelClass: 'label label-success', // the CSS class for the label
        labelStyle: {opacity: 0.85},
      });
      markersArray.push(marker);
      map.panTo(latLng);
      $scope.mainSelection = 'maps';
    }, function() {
    });
  };
  $scope.tracks = function(email){
    $scope.mainSelection = 'loading';
    $scope.selected= email;
    clearOverlays();
    var checkins = new Parse.Query('Checkin');
    var marker;
    checkins.equalTo('email', email);
    checkins.limit(10);
    checkins.descending('createdAt');
    var infowindow = new google.maps.InfoWindow({
      content: ''
    });

    checkins.find({
      success: function(results) {
        FlashService.clear();
        if(results.length > 0 ){
          var track = 0;
          for(var i in results){
            if(results[i].get('coordinates')){
              track ++;
              latLng = new google.maps.LatLng(results[i].get('coordinates')['latitude'],results[i].get('coordinates')['longitude']);
              marker = new MarkerWithLabel({
                position: latLng,
                map: map,
                labelContent: track,
                labelAnchor: new google.maps.Point(10, 38),
                labelClass: 'label label-danger label-round', // the CSS class for the label
                labelStyle: {opacity: 0.95},
                html: results[i].get('message') + ' <br>' + $filter('date')(results[i].createdAt,'dd/MM/yy hh:mm a')
              });
              google.maps.event.addListener(marker, 'click', function() {
                infowindow.setContent(this.html);
                infowindow.open(map, this);
              });
              markersArray.push(marker);
            }
          }
          map.panTo(latLng);
          $scope.mainSelection = 'maps';
        }else{
          if(!flag){
            clearOverlays();
            FlashService.show('No location information for this Device');
            $scope.mainSelection = 'maps';
          }
        }
        $scope.$apply();
      },
      error: function(error) {
        console.error('Parse Error: ' + error.code + ' ' + error.message);
      }
    });
  };

}]);

app.controller('MessagesCtrl',['$scope', 'AuthenticationService', function($scope, AuthenticationService) {
  var users = new Parse.Query('User');
  var useremail = $scope.Useremail;
  $scope.usersFromParse = [];
  $scope.userEmailStack = [];
  users.equalTo('parent', $scope.Useremail);
  users.find({
    success: function(results) {
      for (var i in results) {
        $scope.usersFromParse.push({
          index: i,
          email: results[i].get('email'),
          value: results[i].get('name')
        });
      }
      $('#wea_InputEmail').typeahead({
        name: 'user',
        local: $scope.usersFromParse,
        engine: Hogan,
        template: [
          '<p class="typeahead-name">{{value}}</p>',
          '<p class="typeahead-email">{{email}}</p>'
        ].join('')
      }).on('typeahead:selected', function($e, datum) {
        $scope.$apply(function() {
          $scope.flagAlreadyAdded = false;
          for (var i in $scope.userEmailStack) {
            if ($scope.userEmailStack[i].index === datum.index){
              $scope.flagAlreadyAdded = true;
            }
          }
          if (!$scope.flagAlreadyAdded){
            $scope.userEmailStack.push(datum);
          }
        });
        $(this).val('');
      });
    },
    error: function(error) {
      console.error('Parse Error: ' + error.code + ' ' + error.message);
    }
  });
  $scope.deleteUser = function(index) {
    $scope.$apply(
      $scope.userEmailStack.splice(index, 1)
      );
  };
  $scope.sendMessage = function() {
    var Messages = Parse.Object.extend('messages');
    $scope.width = 0;
    var valueToAdd = 100/$scope.userEmailStack.length;
    var changeProgressValue = function(value){
      $scope.width += value;
      if($scope.width > 95){
        $scope.messagesSend = true;
      }
    };
    $scope.messageSending = true;
    for (var i in  $scope.userEmailStack) {
      var message = new Messages();
      message.set('sender', useremail);
      message.set('receiver', $scope.userEmailStack[i].email);
      message.set('readFlag', false);
      message.set('message', $scope.weaInputMessage);
      message.save(null, {
        success: function() {
          $scope.$apply(changeProgressValue(valueToAdd));
        },
        error: function(error) {
          console.error('Failed to create new object, with error code: ' + error.description);
        }
      });
    }
  };
}]);

app.controller('CheckInCtrl',['$scope','$route' ,'AuthenticationService', function($scope, $route, AuthenticationService) {
  var users = new Parse.Query('User');
  users.equalTo('parent', $scope.Useremail);
  var usersList;
  users.find({
    success: function(results) {
      if(results.length === 0){
        /* flash ! no checkins! */
      }
      else{
        usersList = results.map(function(obj) {
          return {
            id: obj.get('email'),
            name: obj.get('name'),
            photo: obj.get('photo')
          };
        });
      }
    } /*success*/
  }).then(function(usersList){
    var checkins = new Parse.Query('Checkin');
    checkins.descending('createdAt');
    checkins.limit(200);
    checkins.find({
      success: function(results) {
        $scope.checkIns = [];
        _.map(results,function(obj) {
          for(var i in usersList){
            if(usersList[i].get('email') ===  obj.get('email')){
              $scope.checkIns.push( {
                name:usersList[i].get('name'),
                photo: usersList[i].get('photo'),
                location: obj.get('location'),
                message: obj.get('message'),
                time: obj.createdAt
              });
            }
          }
        });
        $scope.$apply();
        angular.element('.chechinDatatable').dataTable( {
          'aoColumns': [
            null,
            null,
            null,
            { 'sType': 'datetime-us' }
          ],
          'aaSorting': [[ 3, 'desc' ]]
        } );
      }
    });
  }).then(function(){

  });
  $scope.reload = function(){
    $route.reload();
  };

}]);

app.controller('EmployeCheckInCtrl', ['$scope', function ($scope) {
  $scope.checkined = false;
  var  geocoder = new google.maps.Geocoder();
  var lat,lng;
  navigator.geolocation.getCurrentPosition(function(position) {
    lat = position.coords.latitude;
    lng = position.coords.longitude;
    var latLng = new google.maps.LatLng(lat, lng);
    geocoder.geocode({'latLng': latLng}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[1]) {
          $scope.place = results[1].formatted_address;
          $scope.$apply();
        } else {
          alert('Location not Avalable');
        }
      } else {
        alert('Geocoder failed due to: ' + status);
      }
    });
  },function(){

  });


  $scope.empCheckin = function(){
    var Checkins = Parse.Object.extend('Checkin');
    var checkin = new Checkins();
    var email =  $scope.Useremail;
    var message = $scope.weaInputMessage ;
    checkin.set('email',email);
    checkin.set('message',message);
    var point = new Parse.GeoPoint({latitude: lat, longitude: lng});
    checkin.set('coordinates', point);
    checkin.set('location', $scope.place);
    checkin.save(null,{
      success: function(){
        $scope.checkined = true;
        $scope.$apply();
        alert('You have successfully checkedIn');
      },
      error: function(error){
        console.error(error);
      }
    });
  }
}]);
app.controller('TaskCtrl', ['$scope', '$route', function ($scope, $route) {
  var tasks = new Parse.Query('Tasks');
  tasks.descending('createdAt');
  tasks.limit(100);
  tasks.equalTo('assignedBy', $scope.Useremail);
  tasks.find({
    success: function(results){
      $scope.Tasks = results.map(function(obj) {
        return {
          id          : obj.id,
          title       : obj.get('title'),
          desc        : obj.get('description'),
          priority    : obj.get('priority'),
          comments    : obj.get('comments'),
          assignedTo  : obj.get('assignedTo'),
          photo       : obj.get('photo'),
          signature   : obj.get('signature'),
          status      : obj.get('status'),
          cDate       : obj.createdAt
        };
      });
      $scope.$apply();
    }
  });
  var users = new Parse.Query('User');
  users.equalTo('parent', $scope.Useremail);
  users.find({
    success: function(results) {
      $scope.TaskUsers = results.map(function(obj) {
        return {
          name: obj.get('name'),
          email: obj.get('email')
        };
      });
      $scope.$apply();
    }
  });
  $scope.addComment = function(task){
    tasks.get(task.id, {
      success: function(object) {
        if(!task.comments){
          task.comments = [];
        }
        task.comments.push($scope.Username + ": " + task.newComment);
        //debugger;
        task.newComment ='';
        $scope.$apply();
        object.set('comments',task.comments);
        object.save();
      },
      error: function(object, error) {
      }
    });
  };
  $scope.addTask = function(newTask){
    var Task = Parse.Object.extend('Tasks');
    var task = new Task();
    task.set('title', newTask.name);
    task.set('assignedTo', newTask.assignTo);
    task.set('assignedBy', $scope.Useremail);
    task.set('priority', newTask.priority);
    task.set('description', newTask.desc);

    task.set('status', 'Open');
    task.save(null,{
      success:function(obj){
        $scope.Tasks.push({
          id          : obj.id,
          title       : obj.get('title'),
          desc        : obj.get('description'),
          priority    : obj.get('priority'),
          comments    : obj.get('comments'),
          assignedTo  : obj.get('assignedTo'),
          photo       : obj.get('photo'),
          signature   : obj.get('signature'),
          status      : obj.get('status'),
          cDate       : obj.createdAt
        });
        $scope.newTask.status = false;
        $scope.$apply();
      }});
  };
}]);