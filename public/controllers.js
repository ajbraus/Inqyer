/*
 * CONTROLLERS
 */

'use strict';

angular.module('myApp.controllers', [])
  .controller('MainCtrl', function ($scope, $auth, Alert) {
    $scope.isAuthenticated = function() {
      return $auth.isAuthenticated();
    };

    $scope.authenticate = function(provider) {
      $auth.authenticate(provider);
    };

    $scope.login = function() {
      $auth.login($scope.login_user)
        .then(function(response) {
          //hide modal
          $('#login-modal').modal('hide');
          //flash alert
          Alert.add('success', "Login Successful", 5000);
        })
        .catch(function(err) {
          Alert.add('danger', err.data.message, 5000);
        });
      $scope.login_user = {};
    }

    $scope.logout = function() {
      $auth.logout();
    }

    $scope.signup = function() {
      $auth.signup($scope.reg_user)
        .then(function(response) {
          //hide modal
          $('#signup-modal').modal('hide');
          //flash alert
          Alert.add('success', "Welcome to Harold", 5000);
          // $location.path('/users/' + response.data._id)
        })
        .catch(function(err) {
          Alert.add('danger', err.data.message, 5000);
        });
      $scope.reg_user = {};
    }
  })

  //ARTICLES
  .controller('ArticlesIndexCtrl', function ($scope, Article) {
    $scope.articles = Article.query();
  })

  .controller('ArticleShowCtrl', function ($scope, $routeParams, Article, Campaign) {
    $scope.campaign = Campaign.get({ id: $routeParams.campaignId });
    $scope.article = Article.get({ id: $routeParams.articleId });
  })


  //CAMPAIGNS
  .controller('CampaignsIndexCtrl', function ($scope, Campaign) {
    $scope.campaigns = Campaign.query()
  })

  .controller('NewCampaignCtrl', function ($scope, $location, Campaign) {
    $scope.campaign = {}

    $scope.createCampaign = function() {
      Campaign.save($scope.campaign, 
        function(data) {
          console.log(data)
          $location.path('/campaigns/' + data._id);
        },
        function(data) {

        });
    }
  })

  .controller('CampaignShowCtrl', function ($scope, $location, $routeParams, Campaign) {
    console.log('service fetching campaign')
    $scope.campaign = Campaign.get({ id: $routeParams.campaignId })
  })


  // USERS
  .controller('DashboardCtrl', function ($scope, $location, AuthService) {
    AuthService.CurrentUser().then(function(response) {
      $scope.user = response.data
    })
    $scope.go = function(path) {
      $location.path(path);
    }
  })

  .controller('UserShowCtrl', function ($scope, $routeParams, AuthService, User) {
    $scope.user = User.get({ id: $routeParams.handle });
  })

  .controller('UserEditCtrl', function ($scope, $location, AuthService) {
    AuthService.CurrentUser().then(function(response) {
      $scope.user = response.data
    })

    $scope.updateUser = function() {
      console.log($scope.user)
      AuthService.updateCurrentUser($scope.user).then(function(response) {
        $scope.user = response.data;
        $location.path('/dashboard');
      })
    }
  })


  ;

