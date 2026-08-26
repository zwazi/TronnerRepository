#!/usr/bin/php
<?php
/*  Race Script
		Includes highscores per map, finish timers, map/cfg rotator, and more
		Requires a TargetZone as a finish line, winzones will not work
		If you are not using Rx Hosting your directory needs write permission
		Made by dukevin (dukevinjduke@gmail.com)
*/

$save_directory_location = "/home/duke/aa/servers/smart/var/logs/";   //The directory to save files. Must end with trailing slash

$countdown_secs_after_finish = 30;	//After someone finishes, how many seconds on the timer before the round ends?

$countdown_if_last_player = true; //If only 1 player remaining, start the timer?

$max_time_limit = -1; //start the timer after this many seconds, -1 to disable time limits

$points = array(10, 7, 5, 4, 3, 2, 1, 1, 1, 1); //points awarded for 1st, 2nd, 3rd, 4th, 5th, etc...

$display_mode = 2; //If set to "1" display a center_message of the map name, 2 for console_message, 3 for both, 0 for no message

$display_prefix = "Current race: 0xffff00"; //When showing the map name, this is appended before it, if $display_mode is 0, this is disabled

$smart_time = true; //If true, the game will determine how many seconds to put on the timer based on previous records instead of using $countdown_secs_after_finish which will be used as the minimum amount of time instead.

$countdown_last_player_extra_time = 0; //If only 1 player remaining, give the last racer this many seconds of extra time to finish. Not needed if $smart_time is true

//Below, inbetween quotes, if you are including maps, put something like: "/path/to/map.aamap.xml". If you are using cfgs, put "mycfg.cfg" 
$includes = array(
	"Default.cfg",
	"100Watts.cfg",
	"ABlazing.cfg",
	"Aflac.cfg",
	"AnimusonConfusion.cfg",
	"Aoi.cfg",
	"ApplePie.cfg",
	"AQuickExplosion.cfg",
	"Arco.cfg",
	"AroundAndAround.cfg",
	"AroundTheHorn.cfg",
	"Arsenal.cfg",
	"AtlanticCharter.cfg",
	"Axe.cfg",
	"BatPigBear.cfg",
	"BeCareful.cfg",
	"BenignRevolution.cfg",
	"Berlin.cfg",
	"BlazingParadise.cfg",
	"BloodyHell.cfg",
	"Boxception.cfg",
	"Broken.cfg",
	"Broken_R.cfg",
	"Buffalo.cfg",
	"CandyBar.cfg",
	"Castle.cfg",
	"Cell.cfg",
	"Charriot.cfg",
	"Cherrio.cfg",
	"Chicken.cfg",
	"Chihuahua.cfg",
	"Claw.cfg",
	"CloseToTheWall.cfg",
	"Colombo.cfg",
	"Compact.cfg",
	"Croma.cfg",
	"CrossingTheWalls.cfg",
	"DeathOctagon.cfg",
	"DeathTrap.cfg",
	"Direct.cfg",
	"Disastro.cfg",
	"Divided.cfg",
	"Dizzy.cfg",
	"DontFlinch.cfg",
	"Dragrace.cfg",
	"Eighty.cfg",
	"EitherWay.cfg",
	"FirePalace.cfg",
	"Flex.cfg",
	"Fobia.cfg",
	"Four.cfg",
	"FrizzleFraz.cfg",
	"GarbagePlate.cfg",
	"GetOwned.cfg",
        "Golf.cfg",
	"Guitar.cfg",
	"Handgrip.cfg",
	"Holiday.cfg",
	"Hyperpod.cfg",
	"Illusion.cfg",
	"Insanity.cfg",
	"ItsABug.cfg",
	"JailBreak.cfg",
	"Jelly.cfg",
	"Jester.cfg",
	"KirbyDance.cfg",
	"Lava.cfg",
	"LetsDance.cfg",
	"lol.cfg",
	"Luigi.cfg",
	"Marathon.cfg",
	"Margarita.cfg",
	"Mario.cfg",
	"Microchip.cfg",
	"Mint.cfg",
	"Moon.cfg",
	"MovinOnUp.cfg",
	"MrRoboto.cfg",
	"Mutant.cfg",
	"Nebraska.cfg",
        "Nopo.cfg",
	"Note.cfg",
	"Nova.cfg",
	"Obelisk.cfg",
	"Octarace.cfg",
	"One.cfg",
	"OnePathv2.cfg",
	"Organius.cfg",
	"PapaShuShu.cfg",
	"Paura.cfg",
	"PewPew.cfg",
	"PillsburyDrummerboy.cfg",
	"Pirata.cfg",
	"Plus.cfg",
	"PointOfNoReturn.cfg",
        "Pow.cfg",
        "PureRacingTorture.cfg",
	"RacersOnYourMark.cfg",
	"RatTunnels.cfg",
	"Resurrection.cfg",
	"RoadLessTraveled.cfg",
	"Robopo.cfg",
	"Roundabout.cfg",
	"Rush.cfg",
	"Scarlet.cfg",
	"Seven.cfg",
	"Shield.cfg",
	"ShoppingMall.cfg",
	"SideBySide.cfg",
	"Six.cfg",
	"SmallSpaces.cfg",
	"Spiral.cfg",
	"SpiralHam.cfg",
	"SquareRoot.cfg",
	"Stardome.cfg",
	"StraightWay.cfg",
	"Sun.cfg",
	"Symmetry.cfg",
	"TannersBigTronDaddy.cfg",
	"Telepo.cfg",
	"TheBathtub.cfg",
        "TheCarrot.cfg",
	"TheRoadNotTaken.cfg",
	"TheTower.cfg",
	"Three.cfg",
	"TikiTime.cfg",
	"TortureChamber.cfg",
	"Trident.cfg",
	"Trijecture.cfg",
	"Trucco.cfg",
	"TurnAround.cfg",
	"Two.cfg",
	"Unfortunate.cfg",
	"Verta.cfg",
	"Verta2.cfg",
	"Voltrobe.cfg",
	"What.cfg",
        "Wrapper.cfg",
	"XploderPro.cfg",
	"Zero.cfg",
	"ZigZag.cfg",
	"ZigZagZaney.cfg",
	"Zipper.cfg",
	"Zone4.cfg");

$rotate_mode = 2; //Set to 1 for simple random, 2 to play each map in order, 3 to randomly pick a map that hasn't been picked yet.

$num_map_plays = 2; //play each map how many times before switching to next map

$zombie_win = false;  //Does the winner get a zombie? (adjust zombie_zone_speed to fit your liking)

$precision = 3; //How many decimal places to show times? A value of 3 shows X.xxx, 2 shows X.xx.  5 is max. 

/*===================== End of customization options =============================*/

//these are queue settings //
$abc = new stdClass; //do not change this//
$abc->diff_start = 76; //start where?
$abc->queue_path = "/home/duke/aa/servers/smart/var/customize/queue.txt"; //you can change this if you need to//
$abc->queue_ex_mode = false; //dont change this
$abc->queue_players = array(); //dont change this either lol
$abc->queue_possible_maps = glob("/home/duke/aa/servers/smart/var/mapfiles/*.cfg");
$abc->queue_has_ended = false;
$abc->queue_enabled = true;
require "colors.php";

$abc->queue = new Queue();

foreach($abc->queue_possible_maps as $key => $map) {
	$abc->queue_possible_maps[$key] = basename($map);
}
sort($abc->queue_possible_maps);

foreach($includes as $key => $value) {
	$includes[$key] = "mapfiles/{$value}";
}

$reccomended_settings = array("target_initial_score 0", "sp_game_type 0", "game_type 0", "sp_finish_type 0", "finish_type 0", "sp_num_ais 0", "num_ais 0", "shot_seek_update_time 0.1", "ladderlog_write_all 1|1");  //these settings should be set for racing mode and is run every round

class Queue {
	public $time;
	public $baserank = 200;
	public $data = array();
	public $update = false;

	function __construct() {
		$this->time = time() - 43201;
	}
	
	public function q($line) {
		global $abc;
		global $out;
		global $colors;
		$split = explode(" ", $line);
		$queue = file($abc->queue_path, FILE_IGNORE_NEW_LINES);
		if($split[5] == "remove") {
			if($split[4] > 1) return false;
			$x = 6;
			$maps = file($abc->queue_path, FILE_IGNORE_NEW_LINES);
			$count = count($maps);
			while(!empty($split[$x])) {
				$split[$x] = trim($split[$x]);
				$split[$x] = str_replace("+", "", $split[$x]);
				if(abs($split[$x]) > $count) {
					pm($split[2], op($out->queue_error_index));
					return;
				}
				if($split[$x] > 0) unset($maps[$split[$x] - 1]);
				else unset($maps[$count + $split[$x]]); // a b c d e  -2    5 - 2 = 3
				$x++;
			}
			$maps = array_values($maps);
			$mapsw = implode("\n", $maps);
			$file_queue = fopen($abc->queue_path, 'w');
			fwrite($file_queue, $mapsw);
			fclose($file_queue);
			c(op($out->queue_modified, array("[player]"), array($split[2])));
			unset($queued_items_str);
			if(empty($maps)) {
				c(op($out->queue_empty));
				return;
			}
			foreach($maps as $mapname) $queued_items_str .= "0x75be62{$mapname}0xffffff, ";
			$queued_items_str = substr($queued_items_str, 0, strlen($queued_items_str) - 2);
			c(op($out->queue_items, array("[queue_items]"), array($queued_items_str)));
			return;
		}
		
		if($split[5] == "time") {
			$dateToReset = (int)(($this->time + 43200 - time()) / 60);
			pm($split[2], op($out->queue_time, array("[restart_time]"), array($dateToReset)));
			return;
		} else if($split[5] == "enable" || $split[5] == "disable") {
			if($split[4] >= 1) return false;
			if($abc->queue_enabled) {
				if($split[5] == "enable")
					pm($split[2], op($out->queue_enable_er, array("[player]"), array($split[2])));
				else if($split[5] == "disable") {
					c(op($out->queue_disable, array("[player]"), array($split[2])));
					$abc->queue_enabled = false;
					$abc->queue_ex_mode = false;
					return;
				}
				return;
			} else {
				if($split[5] == "disable")
					pm($split[2], op($out->queue_disable_er, array("[player]"), array($split[2])));
				else if($split[5] == "enable") {
					c(op($out->queue_enable, array("[player]"), array($split[2])));
					$abc->queue_enabled = true;
				}
				return;
			}
		} else if(!$abc->queue_enabled) {
			pm($split[2], op($out->queue_disabled, array("[player]"), array($split[2])));
			return false;		
		} else if($split[5] == "start") { 
			if(count($queue) < 1) {
				pm($split[2], op($out->queue_start_emp, array("[player]"), array($split[2])));
				$abc->queue_ex_mode = false;
			} else if($abc->queue_ex_mode == false) {
				c(op($out->queue_start, array("[player]"), array($split[2])));
				unset($queued_items_str);
				foreach($queue as $mapname) $queued_items_str .= "0x75be62{$mapname}0xffffff, ";
				$queued_items_str = substr($queued_items_str, 0, strlen($queued_items_str) - 2);
				c(op($out->queue_items, array("[queue_items]"), array($queued_items_str)));
				$abc->queue_ex_mode = true; 
			} else {
				pm($split[2], op($out->queue_start_er, array("[player]"), array($split[2])));
			}
			return;
		} 
		if($split[4] <= 1 || $split[4] == 8) {
			$queue = file($abc->queue_path, FILE_IGNORE_NEW_LINES);
			if($split[5] == "add") { //maybe add support for multiple maps at once? not now.. later.
				$split[6] = trim($split[6]);
				$postback = $split[6];
				if(substr($split[6], strlen($split[6]) - 4, strlen($split[6])) != ".cfg") {
					$nocfg = $split[6];
					$split[6].= ".cfg";
				} else $nocfg = substr($split[6], 0, strlen($split[6]) - 4);
				if(in_array($split[6], $abc->queue_possible_maps)) {
					$maps = file($abc->queue_path, FILE_IGNORE_NEW_LINES);
					$maps[] = $split[6];
					$maps = implode("\n", $maps);
					$file_queue = fopen($abc->queue_path, 'w');
					fwrite($file_queue, $maps);
					fclose($file_queue);
					$str = op($out->queue_add, array("[player]", "[map_valid]", "[queue_remaining]"), array($split[2], $nocfg, ""));
					c($str);
				} else {
					pm($split[2], op($out->queue_add_er, array("[player]", "[map_invalid]"), array($split[2], $postback)));
				}	
				return;				
			} else if($split[5] == "clear") {
				$file_queue = fopen($abc->queue_path, 'w');
				fwrite($file_queue, "");
				fclose($file_queue);
				c(op($out->queue_clear, array("[player]"), array($split[2])));
				return;
			} else if($split[5] == "die" || $split[5] == "stop") {
				if($abc->queue_ex_mode) {
					c(op($out->queue_die, array("[player]"), array($split[2])));
				} else {
					pm($split[2], op($out->queue_die_er, array("[player]"), array($split[2])));
				}
				$abc->queue_ex_mode = false;
				return;
			} else if($split[5] == "list" || $split[5] == "maps") {
				pm($split[2], op($out->queue_list));
				foreach($abc->queue_possible_maps as $key => $map) {
					$keke = $key+1;
					pm($split[2], op($out->queue_list_i, array("[num_list]", "[map_list]"), array($keke, $map)));
					sleep(.001);
				}
				unset($keke);
				return;	
			} else {
				$queue = file($abc->queue_path, FILE_IGNORE_NEW_LINES);
				if(count($queue) < 1) {
					pm($split[2], op($out->queue_empty_a));
				} else {
					unset($queued_items_str);
					foreach($queue as $mapname) $queued_items_str .= "0x75be62{$mapname}0xffffff, ";
					$queued_items_str = substr($queued_items_str, 0, strlen($queued_items_str) - 2);
					pm($split[2], op($out->queue_items, array("[queue_items]"), array($queued_items_str)));
				}
				return;
			}
		} else {
			if($split[5] == "add") { //maybe add support for multiple maps at once? not now.. later.
				if(empty($this->data[$split[2]]['count'])) $this->data[$split[2]]['count'] = 0;
				if($this->data[$split[2]]['count'] < $this->data[$split[2]]['addlim']) {
					$split[6] = trim($split[6]);
					$postback = $split[6];
					if(substr($split[6], strlen($split[6]) - 4, strlen($split[6])) != ".cfg") {
						$nocfg = $split[6];
						$split[6].= ".cfg";
					} else $nocfg = substr($split[6], 0, strlen($split[6]) - 4);
					if(in_array($split[6], $abc->queue_possible_maps)) {
						$maps = file($abc->queue_path, FILE_IGNORE_NEW_LINES);
						$maps[] = $split[6];
						$maps = implode("\n", $maps);
						$file_queue = fopen($abc->queue_path, 'w');
						fwrite($file_queue, $maps);
						fclose($file_queue);
						$this->data[$split[2]]['count']++;
						$remaining = $this->data[$split[2]]['addlim'] - $this->data[$split[2]]['count']; //HOLAZNO
						c(op($out->queue_add, array("[player]", "[map_valid]", "[queue_remaining]"), array($split[2], $nocfg, " ({$remaining})")));
						pm($split[2], "0xf1f1f1 + 0xffffff{$split[2]}, you have 0x6697e2{$remaining}0xffffff queues left.");
					} else {
						pm($split[2], op($out->queue_add_er, array("[player]", "[map_invalid]"), array($split[2], $postback)));
					}		
				} else {
					$dateToReset = (int)(($this->time + 43200 - time()) / 60);
					pm($split[2], "0xf1f1f1 + Sorry 0xffffff{$split[2]}, 0xff7777Error: Out of Queues.0xffffff The queue timer resets in0x6697e2 $dateToReset minutes.");
				}
				return;
			} else if($split[5] == "list" || $split[5] == "maps") {
				pm($split[2], op($out->queue_list));
				foreach($abc->queue_possible_maps as $key => $map) {
					$keke = $key+1;
					pm($split[2], op($out->queue_list_i, array("[num_list]", "[map_list]"), array($keke, $map)));
					sleep(.001);
				}
				unset($keke);
				return;
			} else {
				$queue = file($abc->queue_path, FILE_IGNORE_NEW_LINES);
				if(count($queue) < 1) {
					pm($split[2], op($out->queue_empty_a));
				} else {
					unset($queued_items_str);
					foreach($queue as $mapname) $queued_items_str .= "0x75be62{$mapname}0xffffff, ";
					$queued_items_str = substr($queued_items_str, 0, strlen($queued_items_str) - 2);
					pm($split[2], op($out->queue_items, array("[queue_items]"), array($queued_items_str)));
				}
				$remaining = $this->data[$split[2]]['addlim'] - $this->data[$split[2]]['count'];
				pm($split[2], "0xf1f1f1 + 0xffffff{$split[2]}, you have 0x6697e2{$remaining}0xffffff queues left.");
				return;
			}
		}
	}

	public function update() {
		if(((time() - $this->time) >= 43200) || $this->restart == true) {
			$allMaps = glob("/home/duke/aa/servers/smart/var/mapfiles/*.cfg");
			foreach($allMaps as $key => $map) {
				$map = basename($map);
				$allMaps[$key] = substr($map, 0, strlen($map) - 4);
			}

			$maps = array();
				// Trim down the list of maps by excluding ones not in the "rotation"
			$mapsNotInRotation = array("8Ball","DevilsSandglass","Insane","Killzone","MissionImpossible","MissionImprobable","OctaGone2Death","OnePath","Red","RoadOfDeath","Teleporting","TheMachine","WTF","Zone3");
			$maps = array_diff($allMaps,$mapsNotInRotation);
			$maps = array_values($maps);
			$numMaps = count($maps);
			$totalRanks = array(array());
			$allPlayers = array();
			$minRankToAdd = 0;

			for ($i = 0; $i < $numMaps; $i++) {
				$file = fopen("/home/duke/aa/servers/smart/var/logs/$maps[$i].txt","r") or exit("Unable to open file: $maps[$i].txt");
				$rank = 1;
				$playersWhoFinished = array();
				
				while (true) {
					$line = fgets($file);
					if ($line == "")
						break;
							
					$playerStart = strpos($line," ") + 1; 
					$rest = substr($line,$playerStart);
					// The actual player name
					$player = substr($rest,0,strlen($rest) - 3);

					// Error-handling with names...ignore
					while (substr($player,-1,1) == " " || is_numeric(substr($player,-1,1))) {
						$player = substr($player,0,strlen($player) - 1);
					}
					
					if ($player != "owned@forums" || $hw != "yes") {
								
						if (array_key_exists($player,$totalRanks)) {
							$totalRanks[$player]['sumRanks'] += $rank;
							$totalRanks[$player]['numFinished'] += 1;
						} else {
							$totalRanks[$player]['sumRanks'] = $minRankToAdd + $rank;
							$totalRanks[$player]['numFinished'] += 1;
							$totalRanks[$player]['name'] = $player;
							$totalRanks[$player]['gold'] = 0;
							$totalRanks[$player]['silver'] = 0;
							$totalRanks[$player]['bronze'] = 0;
							$totalRanks[$player]['top10'] = 0;
							$totalRanks[$player]['time'] = time();
							$totalRanks[$player]['adds'] = 0;
							$totalRanks[$player]['addlim'] = 0;
							array_push($allPlayers,$player);
						}
							
						// Update the ranksArray;
						if ($rank == 1) {
							$totalRanks[$player]['gold'] ++;
						} elseif ($rank == 2) {
							$totalRanks[$player]['silver'] ++;
						} elseif ($rank == 3) {
							$totalRanks[$player]['bronze'] ++;
						}
						
						if ($rank <= 10) {
							$totalRanks[$player]['top10'] ++;
						}
						
						array_push($playersWhoFinished,$player);
						$rank++;
					
					}
				}
				
				$minRankToAdd += $rank;
				
				// Update the ranks of everyone who didn't finish the map
				$playersWhoDidNotFinish = array_diff($allPlayers,$playersWhoFinished);
				
				foreach ($playersWhoDidNotFinish as $key) {
					$totalRanks[$key]['sumRanks'] += $rank;
				}
				
				fclose($file);
			}
			asort($totalRanks);
			foreach($totalRanks as $name => $player) {
				$totalRanks[$name]['addlim'] = (int) ceil(250/($totalRanks[$name]['sumRanks'] / $numMaps) + (2*$totalRanks[$name]['gold']) + (1*$totalRanks[$name]['silver']) + (.5*$totalRanks[$name]['bronze']) + ($totalRanks[$name]['numFinished'] /20));
				$this->data[$name]['addlim'] = $totalRanks[$name]['addlim'];
				$this->data[$name]['count'] = 0;
			}
			unset($totalRanks);
			$this->restart = false;
			$this->time = time();
		} 
	}
}

class Player {
	var $name;
	var $pname;
	var $place;
	var $finish_time;
	var $best_time;
	var $num_plays;
	function __construct($name) {
		$this->name = $name;
		$this->read();
		if(empty($this->num_plays)) $this->num_plays = 0;
	}
	function read()
	{
		global $file, $precision;
		$lines = file($file);
		foreach($lines as $line)
		{
			$pieces = explode(" ", $line);  //time name num_plays
			if($pieces[1] == $this->name)
			{
				$this->best_time = round($pieces[0], $precision);
				$this->num_plays = $pieces[2];
				break;
			}
		}
	}
	function write()
	{
		global $file, $current_inc;
		$found = false;
		$lines = file($file);
		if(!file_exists($file))
		{
			c("0xff7777Warning: 0xffffffFile '$current_inc.txt' not found, file creation may have failed. Retrying...");
			$fp = fopen($file, 'w');
		}
		foreach($lines as $i => $line)
		{
			$pieces = explode(" ", $line);
			$pieces[1] = trim($pieces[1]);
			if($pieces[1] == $this->name)
			{
				$lines[$i] = "$this->finish_time $this->name $this->num_plays \n";
				$found = true;
				break;
			}
		}
		if(!$found)
		{
			$lines[] = "$this->finish_time $this->name $this->num_plays \n";
		}
		sort(&$lines, SORT_NUMERIC);
		file_put_contents($file, $lines);
		fclose($fp);
	}
	function finished($time, $place)
	{
		global $points, $players, $current_inc, $precision, $file, $out, $color;
		$this->num_plays++;
		$time = round($time,$precision);
		$this->finish_time = $time;
		$this->place = $place;
		$sufx = suffix($place);
		$score = $points[$place-1];
		if(empty($score)) $score = 0;
		if($place > 1)
		{
			foreach($players as $p)
			{
				if($p->place == 1)
				{
					$first = $p->finish_time;
					$difference = " 0xffffff(" . round($this->finish_time - $p->finish_time,$precision) . " s behind 1st)";
					break;
				}
			}
		}
		else 
			$difference = "";
		//c("0x55ccff > 0xffff99$this->pname 0x55ccfffinished $place$sufx in 0xffff99$time 0x55ccffseconds.$difference 0x808080+{$score} pts");
		if($this->finish_time >= $this->best_time && !empty($this->best_time)) //took longer than alltime best
		{	
			$rank = filetee($this->name, $this->name, 1, false, true) + 1;
			//pm($this->name, "    0xaaaaffYour best time on 0xddddff{$current_inc}0xaaaaff is 0xffffff{$this->best_time} 0xaaaaffs, you were 0xffffff". round($this->finish_time - $this->best_time, $precision)." 0xaaaaffs 0xff7777slower0xaaaaff.");
			$change = round(abs($this->finish_time - $this->best_time), $precision);
			//c("0x55ccff > 0xffff99$this->pname 0x55ccfffinished in 0xffff99$time 0x55ccffseconds (0xffffff{$change}s 0xff7777slower0x55ccff) and remains at rank 0xffffff{$rank}0x55ccff.");
			c(op($out->race_fin_slow, array("[player]", "[time]", "[change]", "[rank]"), array($this->pname, $time, $change, $rank)));
			//pm($this->name, "    0xaaaaffYour best time on 0xddddff{$current_inc}0xaaaaff is 0xffffff{$this->best_time} 0xaaaaffs, you were 0xffffff". round($this->finish_time - $this->best_time, $precision)." 0xaaaaffs 0xff7777slower0xaaaaff.");
		}
		if($this->finish_time < $this->best_time || empty($this->best_time))
		{
			if(!empty($this->best_time)) $oldrank = filetee($this->name, $this->name, 1, false, true) + 1;
			$this->write();
			$newrank = filetee($this->name, $this->name, 1, false, true) + 1;
			//if(empty($this->best_time)) 
				//pm($this->name, "    0xaaaaffThis is your first time finishing 0xddddff{$current_inc}0xaaaaff!");
			//else pm($this->name, "  0x3388ff* 0x55ff88New personal record! You improved 0xffffff" . round($this->best_time - $this->finish_time,$precision) . "0x55ff88 s raising 0xffffff". ($oldrank - $newrank) ." 0x55ff88ranks!");
			if($newrank == 1) c("0xff3333*0xffff33*0x33ff33*0x3366ff*0xffd700Congratulate 0xffffff$this->name 0xffd700for setting a new record on 0xffddaa$current_inc 0xffd700as the fastest time ever!0xff3333*0xffff33*0x33ff33*0x3366ff*");
			else if($newrank == 2) c("0xff3333*0xffff33*0x33ff33*0x3366ff*0xffffff$this->name 0xc0c0c0just ranked as the 0xffffff2nd 0xc0c0c0fastest time for $current_inc!0xff3333*0xffff33*0x33ff33*0x3366ff*\n");
			else if($newrank == 3) c("0xff3333*0xffff33*0x33ff33*0x3366ff*0xffffff$this->name 0xcd7f32just ranked as the 0xffcc003rd 0xcd7f32fastest time for $current_inc!0xff3333*0xffff33*0x33ff33*0x3366ff*");
			if(empty($this->best_time)) {
				//c("0x55ccff > 0xffff99$this->pname 0x55ccfffinished in 0xffff99$time 0x55ccffseconds (0x888888previously unranked0x55ccff) and took rank 0xffffff{$newrank}0x55ccff!");
				c(op($out->race_fin_fast_tr, array("[player]", "[time]", "[rank]"), array($this->pname, $time, $newrank)));
			} elseif($newrank == $oldrank) {
				$change = round(abs($this->finish_time - $this->best_time), $precision);
				//c("0x55ccff > 0xffff99$this->pname 0x55ccfffinished in 0xffff99$time 0x55ccffseconds (0xffffff{$change}s 0x55ff88faster0x55ccff) and remains at rank 0xffffff{$newrank}0x55ccff!");
				c(op($out->race_fin_fast_nr, array("[player]", "[time]", "[change]", "[rank]"), array($this->pname, $time, $change, $newrank)));
			} else {
				$change = round(abs($this->finish_time - $this->best_time), $precision);
				c(op($out->race_fin_fast_ur, array("[player]", "[time]", "[change]", "[rank]"), array($this->pname, $time, $change, $newrank)));
				//c("0x55ccff > 0xffff99$this->pname 0x55ccfffinished in 0xffff99$time 0x55ccffseconds (0xffffff{$change}s 0x55ff88faster0x55ccff) and rose to rank 0xffffff{$newrank}0x55ccff!");
			}
				//pm($this->name, "     0xaaaaaaYou are now rank 0xffffff$newrank 0xaaaaaaof ".(count(file($file)))." as the fastest time for 0xcccccc{$current_inc}0xaaaaaa!");
			
		}
		echo "add_score_player $this->name " . $score . "\n";
		echo "admin_kill_message 0\n";
		echo "kill {$this->name}\n";
		echo "admin_kill_message 1\n";
	}
}
$players = array();
$finished = 0;
$i=0;
$ar = new stdClass;
while(true)
{
	$line = rtrim(fgets(STDIN, 1024));
	if(preg_match("/^PLAYER_GRIDPOS/", $line)) {
		$pieces = explode(" ", $line);
		if(!isset($ar->players->gridpos[$pieces[1]])) {
			$ar->players->gridpos[$pieces[1]] = array($pieces[2], $pieces[3], 5, 0);
		} else {
			$ar->players->gridpos[$pieces[1]] = array($pieces[2], $pieces[3], distance($ar->players->gridpos[$pieces[1]][0], $ar->players->gridpos[$pieces[1]][1], $pieces[2], $pieces[3]), $ar->players->gridpos[$pieces[1]][3]);
		}	
		if($ar->players->gridpos[$pieces[1]][2] < 10) {
			$ar->players->gridpos[$pieces[1]][3]++;
			if($ar->players->gridpos[$pieces[1]][3] > 2) {
				$displayNum = $ar->players->gridpos[$pieces[1]][3] - 2;
				pm($pieces[1], "Are you afk? ({$displayNum} / 5). Speed up!");
			}
		}
		if($ar->players->gridpos[$pieces[1]][3] >= 7) {
			$ar->players->gridpos[$pieces[1]][3] = 0;
			echo "admin_kill_message 0\n";
			echo "kill {$pieces[1]}\n";
			echo "admin_kill_message 1\n";
			c("0xef4f3e{$pieces[1]} was killed for being AFK.");
		}
	}
	if(preg_match("/^CYCLE_CREATED/", $line))
	{
		$split = explode(" ",$line);
		$name = $split[1];
		if(getObject($name) !== false)
		{
			$num_racers++;
			goto end;
		}
		if(strstr($name,"\""))
		{	
			c("0x000000 ! 0xffff00 $name is not allowed to use the characters 0xffffff« or \" 0xffff00 in their name.");
			$clean = str_replace("\"","_",$name);
			$wo = str_replace("\"","",$name);
			echo "rename $wo $clean \n";
			echo "rename $name $clean \n";
		}
		$players[$i] = new Player($split[1]);
		if(isset($pretty))
		{
			for($x = 0; $x < sizeof($pretty); $x++)
			{
				$crack = explode("*%$", $pretty[$x]);
				if($crack[0] == $players[$i]->name)
					$players[$i]->pname = trim($crack[1]);
			}
		}
		if(!isset($players[$i]->pname))
			$players[$i]->pname = $players[$i]->name;
		if($i == 0)
		{
			$xPos = $split[2];
			$yPos = $split[3];
		}
		if(!empty($players[$i]->best_time)) $rank = filetee($players[$i]->name, $players[$i]->name, 1, false, true) + 1;
		$sufx = suffix($rank);
		pm($players[$i]->name, "0x808080Top 3 times for $current_inc:");
		filetee($players[$i]->name, $players[$i]->name, 3, true);
		if(!(strstr($players[$i]->name, '@')))
			$remind = "0x808080(Maybe because you're logged out?)";
		else
			$remind = null;
		if(!empty($players[$i]->best_time)) pm($players[$i]->name, "0x99ddffYour best time for $current_inc is 0xffffff{$players[$i]->best_time}0x99ddff s ranking 0xffffff$rank{$sufx}0x99ddff of ".count(file($file)).".");
		if(empty($players[$i]->best_time)) pm($players[$i]->name, "0x99ddffYou have never won 0xcccccc$current_inc 0x99ddffbefore. $remind");
	
		$i++;
		$num_racers = $i;
	}
	if(preg_match("/^PLAYER_ENTERED/", $line))
	{   
		//PLAYER_ENTERED rx"dukevin 76.174.69.46 Rx«dukevin
		$split = explode(" ", $line);
		$pretty[] = $split[1] . "*%$" . $split[3] . " " . $split[4] . " " . $split[5];
		$pretty = array_slice($pretty,sizeof($pretty)-40,40);
	}
	if(preg_match("/^PLAYER_RENAMED/", $line))
	{
		$split = explode(" ", $line);
		$pretty[] = $split[2] . "*%$" . $split[5] . " " . $split[6] . " " . $split[7];
	}
	if(preg_match("/^ROUND_COMMENCING/", $line))
	{
		foreach($reccomended_settings as $s)
			echo "$s \n";
		unset($players);
		unset($ar->players->gridpos);
		$abc->queue->update();
		$finished = 0;
		$num_racers = 0;
		$a_player_finished = false;
		$i = 0;
		if(empty($num_plays)) $num_plays = 0;
		$num_plays++;
		if($num_plays >= $num_map_plays)
		{
			$pick = pickmap($includes, $rotate_mode);
			$num_plays = 0;
		}
		$current_inc = retrieve($pick);
		c("Reading $current_inc.txt...");
		switch($display_mode)
		{
			case 3:
				c("$display_prefix$current_inc");
			case 2:
				echo "center_message $display_prefix$current_inc\n";
				break;
			case 1:
				c("$display_prefix$current_inc");
		}
		$file = "$save_directory_location" . "$current_inc" . ".txt";
		if(!file_exists($file))
		{
			c("0xffff77Warning: 0xffffff$current_inc.txt not found, creating it...");
			fopen($file, 'w');
			sleep(1);
			if(!file_exists($file))
				c("0xff7777Warning: 0xffffffFile creation failed, scores cannot be saved! Does your directory have write permission?");
		}
		if($smart_time)
			$countdown_secs_after_finish = smart_time($countdown_secs_after_finish);
		echo "target_survive_time " . ($countdown_secs_after_finish+1) ."\n";
		if(mt_rand(0,7)==7) c("0xbbbbffYou can type /stats <name> <optional amount> to view high scores for maps.");
		if(mt_rand(0,7)==7) c("0xbbbbffYou can type /q to view the external map queue.");
		
		@clock("stop");
	}
	if(preg_match("/^TARGETZONE_CONQUERED/", $line) || preg_match("/^ROUND_SCORE/",$line))
	{
		if($finished == 0 || $a_player_finished == true)
			goto end;
		@clock("stop");
		$split = explode(" ", $line);
		if(preg_match("/^TARGETZONE_CONQUERED/", $line))
		{
			echo "spawn_zone win $split[3] $split[4] 1000000 10000 0 0 false 0 0 0\n";
			foreach($players as $p)
				filetee($p->name, $p->name, 3);
		}
		sleep(1);
		if(!empty($split[6])) echo "center_message Winner: {$split[6]}\n";
		echo "collapse_zone\n";
		if(empty($split[6]))
			echo "spawn_zone win $xPos $yPos 1000000 10000 0 0 false 0 0 0\n";
		$a_player_finished = true;
	}
	if(preg_match("/^INVALID_COMMAND/", $line))
	{
		$split = explode(" ", $line);
		//INVALID_COMMAND /cast rx"dukevin 76.174.69.46 accesslevel argument 50
		if($split[1] == "/stats" || $split[1] == "/search")
		{
			$obj = getObject($split[2]);
			if(empty($split[6]) || !isset($split[6])) $split[6] = 3;
			if(empty($split[5]) || !isset($split[5]))
				$split[5] = $split[2];
			search($obj, $split[5], $split[6]);
		}
		elseif($split[1] == "/version")
		{
			$obj = getObject($split[2]);
			version($obj);
		}
		elseif($split[1] == "/debug")
		{
			pm($split[2], "Number of maps rotating: " . count($includes));
			pm($split[2], "Number pnames in memory: " . count($pretty));
			pm($split[2], "Player Objects:");
			foreach($players as $p)
				pm($split[2], "$p->name");			
		}
		elseif($split[1] == "/h")
			temp_help($split[2], $split[5]);
		elseif($split[1] == "/exqueue" || $split[1] == "/eq") { //external queue that can be started.
			pm($split[2], "0xff7777Eq is outdated, try 0xffffff/q instead");
		} else if($split[1] == "/queue" || $split[1] == "/q") {
			$abc->queue->q($line);
		} else if($split[1] == "/s") {
			if($split[4] >= 1) {
			
			} else {
				if($split[5] == "reload") {
					$abc->queue_possible_maps = glob("/home/duke/aa/servers/smart/var/mapfiles/*.cfg");
					foreach($abc->queue_possible_maps as $key => $map) {
						$abc->queue_possible_maps[$key] = basename($map);
					}
					sort($abc->queue_possible_maps);
					require "colors.php";
					pm($split[2], "0xff7777You refreshed the theme colors/output and queueable maps list. Well done.");
				} else if($split[5] == "restart") { //restarts the queue limits and timer
					c(op($out->queue_ResLim, array("[player]"), array($split[2])));
					$abc->queue->restart = true;
				} else if($split[5] == "giveq") {
					if(ctype_digit($split[7])) {
						$abc->queue->data[$split[6]]['addlim'] += $split[7];
						c(op($out->queue_give, array("[player]", "[player_recieving]", "[given]"), array($split[2], $split[6], $split[7])));
					} else pm($split[2], "0xff7777Wat? {$split[7]} is not a number of queues..");
				} else if($split[5] == "takeq") {
					if(ctype_digit($split[7])) {
						$abc->queue->data[$split[6]]['addlim'] -= $split[7];
						c(op($out->queue_take, array("[player]", "[player_recieving]", "[taken]"), array($split[2], $split[6], $split[7])));
					} else pm($split[2], "0xff7777Wat? {$split[7]} is not a number of queues..");
				}  else pm($split[2], "Unknown settings function. (/s restart), (/s reload), (/s grant)");
			}
		}
		else
		{
			pm($split[2], "0xff7777Invalid command, try 0xffffff/stats <name> <amount>");
		}
	}
	if(preg_match("/^TARGETZONE_PLAYER_ENTER/", $line))
	{
		//TARGETZONE_PLAYER_ENTER 2 zonename 100 100 dukevin 90.8824 103.506 1 0 37.6366
		$split = explode(" ", $line);
		$name = $split[5];
		$time = $split[10];
		$obj = getObject($name);
		if(!method_exists($obj,'finished'))
		{	
			c("0xffff77Warning: 0xffffffNo object to operate on, perhaps you just loaded scripts?");
			echo "admin_kill_message 0\n";
			echo "kill $name\n";
			echo "admin_kill_message 1\n";
			goto end;
		}
		if($obj->finish_time > 0) //already hit the finish line
			goto end;
		$finished++;
		$obj->finished($time, $finished);
		$num_racers--;
		if($zombie_win) zombieplz($split[5], $split[6], $split[7]);
		@clock("start", $countdown_secs_after_finish);
		if($num_racers <= 0)
			echo "target_survive_time " . 1 ."\n";
	}
	if(preg_match("/^GAME_TIME/", $line))
	{
		@clock("tick");
		if($max_time_limit <= 0)
			goto end;
		else
		{
			$split = explode(" ", $line);
			if($split[1] == $max_time_limit)
				clock("start", $countdown_secs_after_finish, "kill");
		}
	}
	if(preg_match("/^DEATH_FRAG|DEATH_SUICIDE|PLAYER_KILLED|DEATH_SHOT_FRAG|DEATH_DEATHZONE|DEATH_SHOT_SUICIDE|DEATH_TEAMKILL|DEATH_SHOT_TEAMKILL|DEATH_ZOMBIEZONE|DEATH_DEATHSHOT|DEATH_SELF_DESTRUCT/", $line))
	{
		$split = explode(" ", $line);
		if(empty(getObject($split[1])->finish_time))
			$num_racers--;
		if(sizeof($players) <= 1) //if only 1 player, don't start the timer
			goto end;
		if($countdown_if_last_player == false) //don't start the timer if user doesn't want it
			goto end;
		if($num_racers <= 1)
		{
			if(@clock("getState") == "active" && (empty(getObject($split[1])->finish_time))) //only winner alive, last racer died &&racer not finish
			{
				echo "spawn_zone win $xPos $yPos 1000000 100000 0 0 false 0 0 0\n";
				foreach($players as $p)
					filetee($p->name, $p->name, 3);
				@clock("stop");
				goto end;
			}
			if($num_racers != 0) clock("start", $countdown_secs_after_finish + $countdown_last_player_extra_time, "kill");
		}
	}
	if(preg_match("/^ROUND_WINNER/", $line))
		foreach($players as $p)
		{
			if(!(strstr($p->name, '@')))
				pm($p->name, "0xffddaaYou should /login to protect your times!");
		}
	
end:
}

function clock($action, $duration, $options)
{
	static $state, $time, $options;
	if($action == "start")
	{
		if($state == "active")
			return;
		$state = "active";
		$time = $duration;
		echo("center_message 0xff7777$time               \n");
	}
	if($action == "stop" || $state == "stopped")
	{
		$state = "stopped";
		$options = null;
		return;
	}
	if($action == "tick")
	{
		if($state == "stopped")
			return;
		$time--;
		echo("center_message 0xff7777$time               \n");
		if(empty($time) || $time < 0)
		{
			if($options = "kill")
			{
				global $players;
				echo "admin_kill_message 0\n";
				foreach($players as $p)
					echo "kill $p->name \n";
				echo "admin_kill_message 1\n";
			}
			sleep(1);
			foreach($players as $p)
				filetee($p->name, $p->name, 3);
			$state = "stopped";
			return;
		}
	}
	if($action == "getState")
	{
		return $state;
	}
}
function filetee($search, $requester, $amount = 3, $display_top = false, $onlyrank = false)
{
	global $file;
	$found = false;
	$lines = file($file);
	foreach($lines as $i => $line)
	{
		$pieces = explode(" ", $line);
		$pieces[1] = trim($pieces[1]);
		if($pieces[1] == $search) 
		{	
			$found = true;
			if($onlyrank) return $i;
			break;
		}
	}
	if($display_top) $i = 0;
	if($amount > 150) $amount = 150;
	if($amount %2 == 0) $amount += 1;
	$amount = floor($amount/2);
	if($i == 0 || $i == sizeof($lines)-1) //display an extra entry for 1st and last place
		$amount += 1;
	if($found == false && $display_top == false)
		return false;
	for($x = $i-$amount; $x <= $i+$amount; $x++)
	{
		$cut = explode(" ", $lines[$x]);
		$color = ($cut[1] == $search) ? '0xffff88' : '0xcccccc';
		if(!empty($cut[0])) pm($requester, $color . ($x+1) . ") $cut[0] - $cut[1]");
		usleep(20000);
	}
}
function suffix($number)
{
	$n = (string)$number;
    $n = $n[strlen($n)-1];
	if($n == 1) $sufx = "st";
	elseif($n == 2) $sufx = "nd";
	elseif($n == 3) $sufx = "rd";
	else $sufx = "th";
	if($number == 11 || $number == 12 || $number == 13) //english is weird
		$sufx = "th";
	return $sufx;
}
function retrieve($mapname)
{
	$type = explode(".", $mapname);
	if($type[sizeof($type)-1] == "xml") $head = "MAP_FILE";
	elseif($type[sizeof($type)-1] == "cfg") $head = "INCLUDE";
	
	$tail = $mapname;
	echo $head . " " . $tail . "\n";
	
	$cut = explode("/", $tail);
	$split = explode(".", $cut[sizeof($cut)-1]);
	foreach($split as $element)
	{
		if($element == "aamap" || $element == "xml" || $element == "cfg")
			unset($element);
		$current_inc .= $element;
	}
	$cut = explode("-", $current_inc);
	$current_inc = trim($cut[0]);
	if(empty($current_inc)) c("0xff7777Warning: 0xffffffUnable to retrieve current map name.");
	return empty($current_inc) ? "null" : $current_inc;
}

function zombieplz($name, $x, $y)
{
	echo "spawn_zone zombieOwner $name $name $x $y 1 0 0 0 false\n";
}
function c($string){
	echo "console_message $string \n";
}
function pm($name, $string){
	echo "player_message {$name} \"{$string}\"\n";
}
function getObject($name)
{
	global $players;
	foreach($players as $p)
	{
		if($p->name == $name)
		return $p;
	}
	foreach($players as $p)
	{
		if($p->pname == $name)
		return $p;
	}
	return false;
}
function pickmap($includes, $rotate_mode)
{
	global $abc;
	static $i;
	if(isset($abc->diff_start)) {
		$i = $abc->diff_start;
		unset($abc->diff_start);
	}
	if($abc->queue_ex_mode) {
		if(file_get_contents($abc->queue_path) != "") {
			$maps = file($abc->queue_path, FILE_IGNORE_NEW_LINES);
			if(count($maps) === 1) $abc->queue_has_ended = true;
			$to_return = $maps[0];
			array_shift($maps);
			$maps = implode("\n", $maps);
			$file_queue = fopen($abc->queue_path, 'w');
			fwrite($file_queue, $maps);
			fclose($file_queue);
			return "mapfiles/".$to_return;
		} else $abc->queue_ex_mode = false;
	}
	if($abc->queue_has_ended == true) {
		c("0x55ccff > 0xffff99 The external map queue is 0xffffffempty0xffff99. Map rotation will return to normal (now (I hope)).");
		$abc->queue_has_ended = false;
	}
	if($rotate_mode == 1)
		return $includes[mt_rand(0, sizeof($includes)-1)];
	if($rotate_mode == 2)
	{
		if($i > sizeof($includes)-1 || empty($i)) $i = 0;
		$x = $i;
		$i++;
		return $includes[$x];
	}
	if($rotate_mode == 3)
	{
		if($i > sizeof($includes)-1 || empty($i)) $i = 0;
		if($i == 0) shuffle($includes);
		$x = $i;
		$i++;
		return $includes[$x];
	}

}
function smart_time($countdown_secs_after_finish)
{
	global $file, $current_inc;
	static $initial_countdown_secs;
	if(empty($initial_countdown_secs)) $initial_countdown_secs = $countdown_secs_after_finish;
	if($initial_countdown_secs < 100)
		$MAX_TIME = 75; //smart time will not allow more than 75 secs
	else
		$MAX_TIME = $initial_countdown_secs * 1.3;
	$lines = file($file);
	if(!file_exists($file))	return $initial_countdown_secs;
	$split = explode(" ", $lines[0]);
	$hs = $split[0];
	$split = explode(" ", $lines[1]);
	$hs2nd = $split[0];
	if(empty($hs)) return 60;
	
	if($hs*1.3 < $initial_countdown_secs) return $initial_countdown_secs;
	if(empty($hs2nd)) return $hs * 2 > $MAX_TIME ? $MAX_TIME : round($hs*2);
	if(($hs2nd - $hs) > 8) $hs = $hs2nd;
	return $hs * 1.3 > $MAX_TIME ? $MAX_TIME : round($hs*1.3);
}
function search($me, $search, $amount = 3)
{
	global $players;
	$count = 0;
	foreach($players as $p)
	{
		if($p->pname == $search || $p->name == $search)
		{
			$found = $p->name;
			$count = 1;
			break;
		}
		if(stripos("{$p->pname}","$search") !== false || stripos("{$p->name}","$search") !== false)
		{
			$count++;
			$found = $p->name;
		}
	}
	if($count > 1)
		pm($me->name, "More than one player containing '$search', using $found.");
	if(empty($count))
	{
		if(filetee($search, $me->name, $amount, false, false) == false)
		{
			global $file;
			$lines = file($file);
			foreach($lines as $line)
			{
				$pieces = explode(" ", $line); 
				if(stripos("$pieces[1]","$search") !== false)
				{
					$found = $pieces[1];
					$count++;
					break;
				}
			}
		}
	}
	if(empty($found) || empty($count) || filetee($found, $me->name, -2, false, false) === false)
	{
		pm($me->name, "No times found for player: $search");
		return;
	}
	filetee($found, $me->name, $amount, false, false);
}

function version($me)
{
	pm($me->name, "0xffff00Script programming by 0xffffffdukevin0xffff00 and 0x00ff77[:)]-/-< (tjw2424@forums)");
	pm($me->name, "0xffff00Email at 0xffffffdukevinjduke@gmail.com0xffff00 for suggestions, comments");
	pm($me->name, "0xffff00Made for smart's server");
}
function temp_help($name, $topic)
{
	switch($topic)
	{
		case "rules":
			pm($name,"0x338833Basic player guidelines:");
			pm($name,"0x333388> 0xffffffNo discriminatory remarks.");
			pm($name,"0x333388> 0xffffffNo spamming.");
			pm($name,"0x333388> 0xffffffIf you are going to go AFK, switch to spectator mode.");
			pm($name,"0x333388> 0xffffffDon't waste everybody's time by just sitting there...");
			pm($name,"0x333388> 0xffffffDont feed the trolls");
			pm($name,"0x333388> 0xffffffReport an abusing admin to armaracing@gmail.com with proof they were abusing with screenshots, and the time/date/timezone.");
			pm($name,"0x333388> 0xffffffDon't be an asshole");
			break;
		case "admin":
			pm($name,"0x883333Admin Guidelines: ");
			pm($name,"0x333388> 0xffffffDon't abuse.");
			pm($name,"0x333388> 0xffffffYou are just a normal player, until somebody breaks the rules. Then you step in.");
			pm($name,"0x333388> 0xffffffWe are here to have fun. If at any time you(or a player) are ruining the fun, you/player will be dealt with.");
			break;
		case "contact":
			pm($name, "0x336688Contact Information: 0x8888ffE-mail this address to:");
			pm($name,"1. 0xcc3333Report admin abuse.");
			pm($name,"2. 0xcc3333Request the map making program.");
			pm($name,"3. 0xcc3333Request trial admin.");
			pm($name,"4. 0xcc3333Add maps to the server.");
			pm($name,"0x333388>0x663388Server: 0xffffffArmaRacing@gmail.com");
			break;
		case "q":
		case "eq":
			pm($name, "0x883333Help for the Queue: ");
			pm($name,"0x333388> 0x883333/q0xffff88: 0xffffffLists the maps that are currently in the queue.");
			pm($name,"0x333388> 0x883333/q start0xffff88: 0xffffffStarts the External Queue.");
			pm($name,"0x333388> 0x883333/q stop0xffff88: 0xffffffStops the External Queue. (admin or queuer only)");
			pm($name,"0x333388> 0x883333/q clear0xffff88: 0xffffffClears the External Queue. (admin or queuer only)");
			pm($name,"0x333388> 0x883333/q add [map]0xffff88: 0xffffffAdds any map that's on the list. You dont need to put .cfg.");
			pm($name,"0x333388> 0x883333/q list0xffff88: 0xffffffLists all the maps.");
			break;
		default:
			pm($name, "0xff7777Unknown help topic. Available are: 0xffffffrules, admin, contact, q");
	}
}

function distance($x1, $y1, $x2, $y2) {
	return sqrt(pow(($x2-$x1), 2) + pow(($y2-$y1), 2));
}

function op($raw_string, $to_replace = NULL, $replacements = NULL) {
	$return = $raw_string;
	if(is_null($to_replace) && is_null($replacements)) return $return;
	foreach($to_replace as $key => $string) $return = str_replace($string, $replacements[$key], $return);
	return $return;
}

/*
known bugs:
-/stats on rank 1 display twise
-respawn breaks script
+fixed: you should login to protect your times not showing
-times showed twise if time run out -> instead make all score things shown before round_Commencing?
- $me->num_plays doesn't incriment unless you beat your time //because it doesn't write
+ fixed x of y
*/

?>
